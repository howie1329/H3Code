import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SessionManager,
  type RpcCommand,
  type RpcResponse,
  type RpcSessionState,
  type SessionInfo,
} from "@earendil-works/pi-coding-agent";
import { attachJsonlLineReader, serializeJsonLine } from "./jsonl.js";
import { createSessionEventEnvelope, piRpcToDomainEvents } from "../src/lib/pi-session/adapter.js";
import type { SessionEventEnvelope } from "../src/lib/pi-session/domain-events.js";
import type { RpcExtensionUIRequest, RpcExtensionUIResponse } from "./pi-extension-ui-types.js";
import {
  clearAllIndexedData,
  closePreferencesDatabase,
  getAllSessionWorktrees,
  getPiExecutablePath,
  getPreferences,
  getRepoWorktrees,
  getSessionWorktree,
  removeIndexedRepo,
  removeIndexedSession,
  removeSessionWorktreeMapping,
  recordRepoSessionRows,
  recordRepoUsage,
  recordSessionWorktree,
  revealPreferencesDatabase,
  setPiExecutablePath,
  updateDesktopSettings,
  type DesktopSettings,
} from "./preferences.js";
import { createWorktreeSummary, type WorktreeMapping, type WorktreeSummary } from "./worktree-inventory.js";

type PiConnectionState = "disconnected" | "starting" | "connected" | "exited" | "error";

type PiStatus = {
  state: PiConnectionState;
  agentId?: string;
  repoPath?: string;
  worktreePath?: string;
  diagnostic?: string;
};

type PiSessionSummary = {
  path: string;
  id: string;
  cwd: string;
  agentId?: string;
  worktreePath?: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
};

type ConnectRepoResult = {
  repoPath: string;
  agentId?: string;
  worktreePath?: string;
  sessions: PiSessionSummary[];
  selectedSessionPath?: string;
  state?: RpcSessionState;
  messages?: unknown[];
};

type PiSlashCommand = {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  location?: string;
  path?: string;
  sourceInfo?: {
    path?: string;
    source?: string;
    scope?: string;
    origin?: string;
    baseDir?: string;
  };
};

type SessionDiff = {
  patch: string;
  changedFiles: number;
};

type WorktreeCleanupResult = {
  worktrees: WorktreeSummary[];
  removed: number;
};

type PendingRequest = {
  resolve: (response: RpcResponse) => void;
  reject: (error: Error) => void;
};

type PiAgentConnection = {
  id: string;
  process: ChildProcessWithoutNullStreams;
  repoPath: string;
  worktreePath: string;
  status: PiStatus;
  selectedSessionPath?: string;
  nextRequestId: number;
  rpcQueue: Promise<unknown>;
  stopReadingStdout?: () => void;
  pendingRequests: Map<string, PendingRequest>;
};

type SessionSnapshot = {
  state: RpcSessionState;
  messages: unknown[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const windowBackground = {
  light: "rgb(250, 250, 250)",
  dark: "rgb(31, 31, 31)",
} as const;

function getWindowBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? windowBackground.dark : windowBackground.light;
}

function getWindowIconPath() {
  return isDev
    ? path.join(__dirname, "../static/icons/h3code-light.png")
    : path.join(__dirname, "../build/icons/h3code-light.png");
}

let mainWindow: BrowserWindow | undefined;
let status: PiStatus = { state: "disconnected" };
let activeAgentId: string | undefined;
const piAgents = new Map<string, PiAgentConnection>();
const extensionUiRequestAgents = new Map<string, string>();
const maxDiffBytes = 8 * 1024 * 1024;
const RPC_REQUEST_TIMEOUT_MS = 30_000;

function enqueuePiRpc<T>(agent: PiAgentConnection, task: () => Promise<T>): Promise<T> {
  const run = agent.rpcQueue.then(task, task);
  agent.rpcQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function resetPiRpcQueue(agent: PiAgentConnection) {
  agent.rpcQueue = Promise.resolve();
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "H3Code",
    backgroundColor: getWindowBackgroundColor(),
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow = window;

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = undefined;
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void window.loadFile(path.join(__dirname, "../build/index.html"));
}

function emitStatus(nextStatus: PiStatus) {
  status = nextStatus;
  mainWindow?.webContents.send("pi:status", status);
}

function emitAgentStatus(agent: PiAgentConnection, nextStatus: Omit<PiStatus, "agentId" | "repoPath" | "worktreePath">) {
  agent.status = {
    ...nextStatus,
    agentId: agent.id,
    repoPath: agent.repoPath,
    worktreePath: agent.worktreePath,
  };

  if (activeAgentId === agent.id) {
    emitStatus(agent.status);
    return;
  }

  mainWindow?.webContents.send("pi:status", agent.status);
}

function emitSessionEvent(agentId: string, event: SessionEventEnvelope) {
  mainWindow?.webContents.send("pi:session-event", { ...event, agentId });
}

function emitDomainEventsFromRaw(agentId: string, raw: unknown) {
  for (const domainEvent of piRpcToDomainEvents(raw)) {
    emitSessionEvent(agentId, createSessionEventEnvelope(domainEvent));
  }
}

function emitExtensionUiRequest(agentId: string, request: RpcExtensionUIRequest) {
  extensionUiRequestAgents.set(request.id, agentId);
  mainWindow?.webContents.send("pi:extension-ui-request", { ...request, agentId });
}

function rejectPendingRequests(agent: PiAgentConnection, error: Error) {
  for (const request of agent.pendingRequests.values()) {
    request.reject(error);
  }

  agent.pendingRequests.clear();
}

async function assertDirectory(repoPath: string) {
  const info = await stat(repoPath);

  if (!info.isDirectory()) {
    throw new Error("Selected path is not a directory.");
  }
}

function serializeSession(session: SessionInfo): PiSessionSummary {
  return {
    path: session.path,
    id: session.id,
    cwd: session.cwd,
    name: session.name,
    created: session.created.toISOString(),
    modified: session.modified.toISOString(),
    messageCount: session.messageCount,
    firstMessage: session.firstMessage,
  };
}

async function listSessionsForRepo(repoPath: string, markRecent = false) {
  await assertDirectory(repoPath);
  const sessions = await listAllSessionsForLogicalRepo(repoPath);
  if (markRecent) {
    recordRepoUsage(repoPath);
  }
  recordRepoSessionRows(repoPath, sessions);
  return sortSessionsForRepoByIndexedRecency(repoPath, sessions);
}

function sortSessionsForRepoByIndexedRecency(repoPath: string, sessions: PiSessionSummary[]) {
  const indexedOrderByPath = new Map(
    getPreferences().indexedSessions
      .filter((session) => session.repoPath === repoPath)
      .map((session, index) => [session.path, index]),
  );

  return [...sessions].sort((a, b) => {
    const aIndex = indexedOrderByPath.get(a.path) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = indexedOrderByPath.get(b.path) ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return Date.parse(b.modified) - Date.parse(a.modified);
  });
}

async function listAllSessionsForLogicalRepo(repoPath: string): Promise<PiSessionSummary[]> {
  const sessionsByPath = new Map<string, PiSessionSummary>();

  for (const session of await SessionManager.list(repoPath)) {
    sessionsByPath.set(session.path, serializeSession(session));
  }

  for (const worktree of getRepoWorktrees(repoPath)) {
    if (!existsSync(worktree.worktreePath)) {
      continue;
    }

    for (const session of await SessionManager.list(worktree.worktreePath)) {
      sessionsByPath.set(session.path, {
        ...serializeSession(session),
        cwd: repoPath,
        worktreePath: worktree.worktreePath,
      });
    }
  }

  for (const agent of piAgents.values()) {
    if (agent.repoPath !== repoPath) {
      continue;
    }

    for (const session of await SessionManager.list(agent.worktreePath)) {
      sessionsByPath.set(session.path, {
        ...serializeSession(session),
        cwd: repoPath,
        agentId: agent.id,
        worktreePath: agent.worktreePath,
      });
    }
  }

  return [...sessionsByPath.values()].sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified));
}

async function createAgentWorktree(repoPath: string) {
  const repoCheck = await runGit(["rev-parse", "--is-inside-work-tree"], repoPath);

  if (repoCheck.status !== 0 || repoCheck.stdout.trim() !== "true") {
    throw new Error("Multiple live PI agents require a git repository.");
  }

  const rootResult = await runGit(["rev-parse", "--show-toplevel"], repoPath);
  const root = rootResult.stdout.trim() || repoPath;
  const worktreesDir = path.join(app.getPath("userData"), "pi-worktrees");
  await mkdir(worktreesDir, { recursive: true });

  const worktreePath = path.join(worktreesDir, `${basename(root)}-${randomUUID().slice(0, 8)}`);
  const result = await runGit(["worktree", "add", "--detach", worktreePath, "HEAD"], root);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Could not create git worktree.");
  }

  return worktreePath;
}

function basename(value: string) {
  const clean = value.replace(/\/+$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1) || clean;
}

async function deleteSessionFile(sessionPath: string): Promise<"trash" | "unlink"> {
  const trashArgs = sessionPath.startsWith("-") ? ["--", sessionPath] : [sessionPath];
  const trashResult = spawnSync("trash", trashArgs, { encoding: "utf-8" });

  if (trashResult.status === 0 || !existsSync(sessionPath)) {
    return "trash";
  }

  try {
    await unlink(sessionPath);
    return "unlink";
  } catch (error) {
    const unlinkError = error instanceof Error ? error.message : String(error);
    const trashError = getTrashErrorMessage(trashResult);
    throw new Error(trashError ? `${unlinkError} (${trashError})` : unlinkError);
  }
}

function getTrashErrorMessage(result: ReturnType<typeof spawnSync>) {
  const parts: string[] = [];

  if (result.error) {
    parts.push(result.error.message);
  }

  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";

  if (stderr) {
    parts.push(stderr.split("\n")[0] ?? stderr);
  }

  return parts.length > 0 ? `trash: ${parts.join(" · ").slice(0, 200)}` : undefined;
}

async function deletePiSession(repoPath: string, sessionPath: string) {
  await assertDirectory(repoPath);
  const sessionWorktree = getSessionWorktree(sessionPath);
  const sessionCwd = sessionWorktree?.worktreePath ?? repoPath;
  const sessions = await SessionManager.list(sessionCwd);
  const session = sessions.find((item) => item.path === sessionPath);

  if (!session) {
    throw new Error("Session does not belong to this repo.");
  }

  const activeAgent = getAgentBySessionPath(sessionPath);
  if (activeAgent) {
    await stopPiAgent(activeAgent);
  }

  await deleteSessionFile(sessionPath);
  const removeWorktreeMapping = await cleanupWorktreeForDeletedSession(
    sessionWorktree
      ? {
          ...sessionWorktree,
          repoName: basename(sessionWorktree.repoPath),
        }
      : undefined,
  );
  removeIndexedSession(sessionPath, { removeWorktreeMapping });

  return listSessionsForRepo(repoPath, true);
}

async function listPiSessions() {
  const agent = getActiveAgent();

  if (!agent) {
    throw new Error("Select a repo before listing sessions.");
  }

  return listSessionsForRepo(agent.repoPath, true);
}

async function getSessionDiff(): Promise<SessionDiff> {
  const agent = getActiveAgent();

  if (!agent) {
    return { patch: "", changedFiles: 0 };
  }

  await assertDirectory(agent.worktreePath);

  const repoCheck = await runGit(["rev-parse", "--is-inside-work-tree"], agent.worktreePath);

  if (repoCheck.status !== 0 || repoCheck.stdout.trim() !== "true") {
    return { patch: "", changedFiles: 0 };
  }

  const trackedDiff = await runGit(["diff", "HEAD", "--no-ext-diff", "--no-color", "--binary"], agent.worktreePath);
  const untrackedFiles = await getUntrackedFiles(agent.worktreePath);
  const patches = trackedDiff.stdout ? [trackedDiff.stdout] : [];
  let patchBytes = trackedDiff.stdout.length;

  for (const file of untrackedFiles) {
    const fileDiff = await getUntrackedFileDiff(agent.worktreePath, file);

    if (fileDiff) {
      patches.push(fileDiff);
      patchBytes += fileDiff.length;
    }

    if (patchBytes > maxDiffBytes) {
      throw new Error("Git diff is too large to display.");
    }
  }

  const patch = patches.join("\n");

  return {
    patch,
    changedFiles: countChangedFiles(patch),
  };
}

async function getUntrackedFiles(repoPath: string) {
  const result = await runGit(["ls-files", "--others", "--exclude-standard", "-z"], repoPath);

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout.split("\0").filter(Boolean);
}

async function getUntrackedFileDiff(repoPath: string, filePath: string) {
  const result = await runGit(["diff", "--no-ext-diff", "--no-color", "--no-index", "--binary", "--", "/dev/null", filePath], repoPath);

  return result.stdout;
}

function countChangedFiles(patch: string) {
  const gitDiffHeaders = patch.split("\n").filter((line) => line.startsWith("diff --git ")).length;

  if (gitDiffHeaders > 0) {
    return gitDiffHeaders;
  }

  return patch.split("\n").filter((line) => line.startsWith("diff ")).length;
}

function runGit(args: string[], cwd: string) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;

      if (stdout.length > maxDiffBytes) {
        settled = true;
        child.kill();
        reject(new Error("Git diff is too large to display."));
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (status) => {
      if (settled) {
        return;
      }

      resolve({ status, stdout, stderr });
    });
  });
}

function getWorktreesDir() {
  return path.join(app.getPath("userData"), "pi-worktrees");
}

function isAppOwnedWorktree(worktreePath: string) {
  const relativePath = path.relative(getWorktreesDir(), worktreePath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

async function getWorktreeDirtyState(worktreePath: string): Promise<WorktreeSummary["dirtyState"]> {
  if (!existsSync(worktreePath)) {
    return "clean";
  }

  const repoCheck = await runGit(["rev-parse", "--is-inside-work-tree"], worktreePath);

  if (repoCheck.status !== 0 || repoCheck.stdout.trim() !== "true") {
    return "unknown";
  }

  const statusResult = await runGit(["status", "--porcelain=v1", "--untracked-files=all"], worktreePath);

  if (statusResult.status !== 0) {
    return "unknown";
  }

  return statusResult.stdout.trim().length > 0 ? "dirty" : "clean";
}

function getActiveAgentIdForWorktree(worktreePath: string) {
  return [...piAgents.values()].find((agent) => agent.worktreePath === worktreePath)?.id;
}

async function getWorktreeSummary(mapping: WorktreeMapping): Promise<WorktreeSummary> {
  const exists = existsSync(mapping.worktreePath);
  const sessionFileExists = existsSync(mapping.sessionPath);
  const activeAgentId = getActiveAgentIdForWorktree(mapping.worktreePath);

  return createWorktreeSummary(
    mapping,
    {
      exists,
      appOwned: isAppOwnedWorktree(mapping.worktreePath),
      dirtyState: await getWorktreeDirtyState(mapping.worktreePath),
      sessionFileExists,
    },
    { activeAgentId },
  );
}

async function listWorktrees(): Promise<WorktreeSummary[]> {
  return Promise.all(getAllSessionWorktrees().map((mapping) => getWorktreeSummary(mapping)));
}

async function removeCleanWorktreeDirectory(summary: WorktreeSummary) {
  if (!summary.appOwned) {
    throw new Error("Only H3Code-managed worktrees can be removed.");
  }

  if (summary.dirtyState !== "clean") {
    throw new Error("Dirty worktrees are kept. Reveal the worktree to review its changes.");
  }

  if (!summary.exists) {
    return;
  }

  const gitResult = existsSync(summary.repoPath)
    ? await runGit(["worktree", "remove", summary.worktreePath], summary.repoPath)
    : { status: 1, stdout: "", stderr: "" };

  if (gitResult.status === 0 || !existsSync(summary.worktreePath)) {
    return;
  }

  await rm(summary.worktreePath, { recursive: true, force: true });
}

async function cleanupWorktreeForDeletedSession(mapping: WorktreeMapping | undefined) {
  if (!mapping) {
    return true;
  }

  const summary = await getWorktreeSummary(mapping);

  if (!summary.appOwned || !summary.exists) {
    return true;
  }

  if (summary.dirtyState !== "clean") {
    return false;
  }

  try {
    await removeCleanWorktreeDirectory(summary);
    return true;
  } catch {
    return false;
  }
}

async function removeStaleWorktree(sessionPath: string): Promise<WorktreeCleanupResult> {
  const mapping = getAllSessionWorktrees().find((worktree) => worktree.sessionPath === sessionPath);

  if (!mapping) {
    return { worktrees: await listWorktrees(), removed: 0 };
  }

  const summary = await getWorktreeSummary(mapping);

  if (!summary.pruneable) {
    throw new Error("This worktree is not a clean stale H3Code worktree.");
  }

  await removeCleanWorktreeDirectory(summary);
  removeSessionWorktreeMapping(sessionPath);

  return { worktrees: await listWorktrees(), removed: 1 };
}

async function pruneStaleWorktrees(): Promise<WorktreeCleanupResult> {
  let removed = 0;

  for (const summary of await listWorktrees()) {
    if (!summary.pruneable) {
      continue;
    }

    await removeCleanWorktreeDirectory(summary);
    removeSessionWorktreeMapping(summary.sessionPath);
    removed += 1;
  }

  return { worktrees: await listWorktrees(), removed };
}

function getActiveAgent() {
  return activeAgentId ? piAgents.get(activeAgentId) : undefined;
}

function getAgentBySessionPath(sessionPath: string) {
  const directAgent = [...piAgents.values()].find((agent) => agent.selectedSessionPath === sessionPath);

  if (directAgent) {
    return directAgent;
  }

  const worktree = getSessionWorktree(sessionPath);

  if (!worktree) {
    return undefined;
  }

  return [...piAgents.values()].find((agent) => agent.worktreePath === worktree.worktreePath);
}

async function stopPiAgent(agent: PiAgentConnection) {
  piAgents.delete(agent.id);

  if (activeAgentId === agent.id) {
    activeAgentId = undefined;
    emitStatus({ state: "disconnected" });
  }

  agent.stopReadingStdout?.();
  agent.stopReadingStdout = undefined;
  agent.process.removeAllListeners();
  agent.process.stdout.removeAllListeners();
  agent.process.stderr.removeAllListeners();
  agent.process.kill();
  rejectPendingRequests(agent, new Error("PI RPC process stopped."));
  resetPiRpcQueue(agent);
}

async function stopAllPiAgents() {
  await Promise.all([...piAgents.values()].map((agent) => stopPiAgent(agent)));
}

async function startPiAgent(repoPath: string, worktreePath?: string) {
  await assertDirectory(repoPath);
  const agentWorktreePath = worktreePath ?? await createAgentWorktree(repoPath);
  await assertDirectory(agentWorktreePath);

  const agent: PiAgentConnection = {
    id: `agent-${randomUUID()}`,
    process: undefined as unknown as ChildProcessWithoutNullStreams,
    repoPath,
    worktreePath: agentWorktreePath,
    status: { state: "starting", repoPath, worktreePath: agentWorktreePath },
    nextRequestId: 1,
    rpcQueue: Promise.resolve(),
    pendingRequests: new Map(),
  };

  activeAgentId = agent.id;
  emitAgentStatus(agent, { state: "starting" });

  const piExecutable = getPiExecutablePath();
  agent.process = spawn(piExecutable, ["--mode", "rpc"], {
    cwd: agentWorktreePath,
    env: process.env,
  });
  piAgents.set(agent.id, agent);

  agent.stopReadingStdout = attachJsonlLineReader(agent.process.stdout, (line: string) => {
    try {
      handleRpcMessage(agent, JSON.parse(line) as RpcResponse | unknown);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitAgentStatus(agent, {
        state: "error",
        diagnostic: `Malformed PI RPC JSON: ${message}`,
      });
    }
  });

  agent.process.stderr.setEncoding("utf8");
  agent.process.stderr.on("data", (chunk: string) => {
    const diagnostic = chunk.trim();

    if (diagnostic) {
      emitAgentStatus(agent, { state: agent.status.state, diagnostic });
    }
  });

  agent.process.on("error", (error) => {
    rejectPendingRequests(agent, error);
    emitAgentStatus(agent, { state: "error", diagnostic: error.message });
  });

  agent.process.on("exit", (code, signal) => {
    const diagnostic = `PI exited${code === null ? "" : ` with code ${code}`}${signal ? ` (${signal})` : ""}.`;
    piAgents.delete(agent.id);
    if (activeAgentId === agent.id) {
      activeAgentId = undefined;
    }
    rejectPendingRequests(agent, new Error(diagnostic));
    emitAgentStatus(agent, { state: "exited", diagnostic });
  });

  return agent;
}

async function ensurePiHandshake(agent: PiAgentConnection) {
  await sendCommand<Extract<RpcResponse, { command: "get_state"; success: true }>>(agent, { type: "get_state" });
  emitAgentStatus(agent, {
    state: "connected",
    diagnostic: piAgents.size >= 4 ? "Four or more PI agents are running. Watch CPU usage and provider spend." : undefined,
  });
}

function handleRpcMessage(agent: PiAgentConnection, message: RpcResponse | unknown) {
  if (isRpcResponse(message)) {
    const pending = message.id ? agent.pendingRequests.get(message.id) : undefined;

    if (pending && message.id) {
      agent.pendingRequests.delete(message.id);
      pending.resolve(message);
      return;
    }

    if (message.id) {
      const command = "command" in message && typeof message.command === "string" ? message.command : "unknown";
      emitStatus({
        state: agent.status.state,
        agentId: agent.id,
        repoPath: agent.repoPath,
        worktreePath: agent.worktreePath,
        diagnostic: `Unexpected PI RPC response for ${command} (${message.id}).`,
      });
      return;
    }
  }

  if (isExtensionUiRequest(message)) {
    handleExtensionUiRequest(agent, message);
    return;
  }

  emitDomainEventsFromRaw(agent.id, message);
}

function isExtensionUiRequest(message: unknown): message is RpcExtensionUIRequest {
  return Boolean(message && typeof message === "object" && "type" in message && message.type === "extension_ui_request");
}

function handleExtensionUiRequest(agent: PiAgentConnection, request: RpcExtensionUIRequest) {
  if (
    request.method === "notify" ||
    request.method === "setStatus" ||
    request.method === "setWidget" ||
    request.method === "setTitle"
  ) {
    emitDomainEventsFromRaw(agent.id, request);
    return;
  }

  emitExtensionUiRequest(agent.id, request);
}

async function sendExtensionUiResponse(response: RpcExtensionUIResponse) {
  const agentId = extensionUiRequestAgents.get(response.id) ?? activeAgentId;
  const agent = agentId ? piAgents.get(agentId) : undefined;

  if (!agent) {
    throw new Error("PI RPC is not connected.");
  }

  extensionUiRequestAgents.delete(response.id);
  return enqueuePiRpc(agent, async () => {
    writeExtensionUiResponse(agent, response);
  });
}

function writeExtensionUiResponse(agent: PiAgentConnection, response: RpcExtensionUIResponse) {
  if (!agent.process.stdin.writable) {
    throw new Error("PI RPC is not connected.");
  }

  agent.process.stdin.write(serializeJsonLine(response));
}

function isRpcResponse(message: unknown): message is RpcResponse {
  return Boolean(message && typeof message === "object" && "type" in message && message.type === "response");
}

async function sendCommand<T extends RpcResponse>(agent: PiAgentConnection, command: RpcCommand): Promise<T> {
  return enqueuePiRpc(agent, () => sendCommandImmediate<T>(agent, command));
}

function sendCommandImmediate<T extends RpcResponse>(agent: PiAgentConnection, command: RpcCommand): Promise<T> {
  if (!agent.process.stdin.writable) {
    return Promise.reject(new Error("PI RPC is not connected."));
  }

  const id = `h3code-${agent.nextRequestId++}`;
  const commandWithId = { ...command, id };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      agent.pendingRequests.delete(id);
      reject(new Error(`Timeout waiting for response to ${command.type}.`));
    }, RPC_REQUEST_TIMEOUT_MS);

    agent.pendingRequests.set(id, {
      resolve: (response) => {
        clearTimeout(timeout);

        if (!response.success) {
          reject(new Error(response.error));
          return;
        }

        resolve(response as T);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });

    agent.process.stdin.write(serializeJsonLine(commandWithId), (error) => {
      if (!error) {
        return;
      }

      clearTimeout(timeout);
      agent.pendingRequests.delete(id);
      reject(error);
    });
  });
}

async function getSessionState() {
  const agent = requireActiveAgent();
  const stateResponse = await sendCommand<Extract<RpcResponse, { command: "get_state"; success: true }>>(agent, { type: "get_state" });
  return stateResponse.data;
}

function requireActiveAgent() {
  const agent = getActiveAgent();

  if (!agent) {
    throw new Error("PI RPC is not connected.");
  }

  return agent;
}

async function getStateAndMessages(agent = requireActiveAgent()): Promise<SessionSnapshot> {
  const stateResponse = await sendCommand<Extract<RpcResponse, { command: "get_state"; success: true }>>(agent, { type: "get_state" });
  const messagesResponse = await sendCommand<Extract<RpcResponse, { command: "get_messages"; success: true }>>(agent, { type: "get_messages" });

  return {
    state: stateResponse.data,
    messages: messagesResponse.data.messages as unknown[],
  };
}

async function getSessionStats() {
  const response = await sendCommand<Extract<RpcResponse, { command: "get_session_stats"; success: true }>>(requireActiveAgent(), { type: "get_session_stats" });
  return response.data;
}

async function getPiCommands() {
  const response = await sendCommand<Extract<RpcResponse, { command: "get_commands"; success: true }>>(requireActiveAgent(), { type: "get_commands" });
  return response.data.commands.map(normalizeSlashCommand);
}

async function getAvailableModels() {
  const response = await sendCommand<Extract<RpcResponse, { command: "get_available_models"; success: true }>>(requireActiveAgent(), {
    type: "get_available_models",
  });
  return response.data.models;
}

async function setPiModel(provider: string, modelId: string) {
  const response = await sendCommand<Extract<RpcResponse, { command: "set_model"; success: true }>>(requireActiveAgent(), {
    type: "set_model",
    provider,
    modelId,
  });
  return response.data;
}

type PiThinkingLevel = Extract<RpcCommand, { type: "set_thinking_level" }>["level"];

async function setPiThinkingLevel(level: PiThinkingLevel) {
  await sendCommand<Extract<RpcResponse, { command: "set_thinking_level"; success: true }>>(requireActiveAgent(), {
    type: "set_thinking_level",
    level,
  });
}

type PiQueueMode = Extract<RpcCommand, { type: "set_steering_mode" }>["mode"];

async function setPiSteeringMode(mode: PiQueueMode) {
  await sendCommand<Extract<RpcResponse, { command: "set_steering_mode"; success: true }>>(requireActiveAgent(), {
    type: "set_steering_mode",
    mode,
  });
}

async function setPiFollowUpMode(mode: PiQueueMode) {
  await sendCommand<Extract<RpcResponse, { command: "set_follow_up_mode"; success: true }>>(requireActiveAgent(), {
    type: "set_follow_up_mode",
    mode,
  });
}

async function setPiAutoCompaction(enabled: boolean) {
  await sendCommand<Extract<RpcResponse, { command: "set_auto_compaction"; success: true }>>(requireActiveAgent(), {
    type: "set_auto_compaction",
    enabled,
  });
}

function normalizeSlashCommand(command: unknown): PiSlashCommand {
  const record = toRecord(command);
  const sourceInfo = toRecord(record.sourceInfo);

  return {
    name: typeof record.name === "string" ? record.name : "",
    description: typeof record.description === "string" ? record.description : undefined,
    source: isSlashCommandSource(record.source) ? record.source : "prompt",
    location: typeof record.location === "string" ? record.location : typeof sourceInfo.scope === "string" ? sourceInfo.scope : undefined,
    path: typeof record.path === "string" ? record.path : typeof sourceInfo.path === "string" ? sourceInfo.path : undefined,
    sourceInfo: Object.keys(sourceInfo).length > 0
      ? {
          path: typeof sourceInfo.path === "string" ? sourceInfo.path : undefined,
          source: typeof sourceInfo.source === "string" ? sourceInfo.source : undefined,
          scope: typeof sourceInfo.scope === "string" ? sourceInfo.scope : undefined,
          origin: typeof sourceInfo.origin === "string" ? sourceInfo.origin : undefined,
          baseDir: typeof sourceInfo.baseDir === "string" ? sourceInfo.baseDir : undefined,
        }
      : undefined,
  };
}

function isSlashCommandSource(value: unknown): value is PiSlashCommand["source"] {
  return value === "extension" || value === "prompt" || value === "skill";
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function switchPiSession(sessionPath: string) {
  let agent = getAgentBySessionPath(sessionPath);
  const mappedWorktree = getSessionWorktree(sessionPath);

  if (!agent && mappedWorktree) {
    agent = await startPiAgent(mappedWorktree.repoPath, mappedWorktree.worktreePath);
    await ensurePiHandshake(agent);
  }

  agent ??= requireActiveAgent();
  activeAgentId = agent.id;
  emitStatus(agent.status);

  await sendCommand<Extract<RpcResponse, { command: "switch_session"; success: true }>>(agent, {
    type: "switch_session",
    sessionPath,
  });

  recordRepoUsage(agent.repoPath, sessionPath);

  const snapshot = await getStateAndMessages(agent);
  agent.selectedSessionPath = snapshot.state.sessionFile ?? sessionPath;
  return {
    ...snapshot,
    agentId: agent.id,
    repoPath: agent.repoPath,
    worktreePath: agent.worktreePath,
  };
}

ipcMain.handle("repo:select", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return { path: result.filePaths[0] };
});

ipcMain.handle("dialog:pick-executable", async () => {
  const result = await dialog.showOpenDialog({
    properties: process.platform === "darwin" ? ["openFile", "treatPackageAsDirectory"] : ["openFile"],
    title: "Select PI executable",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return { path: result.filePaths[0] };
});

ipcMain.handle("pi:connect-repo", async (_event, repoPath: string, selectedSessionPath?: string): Promise<ConnectRepoResult> => {
  let agent = selectedSessionPath ? getAgentBySessionPath(selectedSessionPath) : undefined;
  const mappedWorktree = selectedSessionPath ? getSessionWorktree(selectedSessionPath) : undefined;

  if (!agent) {
    agent = await startPiAgent(repoPath, mappedWorktree?.worktreePath);
    await ensurePiHandshake(agent);
  } else {
    activeAgentId = agent.id;
    emitStatus(agent.status);
  }

  const sessions = await listPiSessions();
  const selectedSession = sessions.find((session) => session.path === selectedSessionPath) ?? sessions[0];

  if (!selectedSession) {
    return { repoPath, agentId: agent.id, worktreePath: agent.worktreePath, sessions };
  }

  const { state, messages } = await switchPiSession(selectedSession.path);

  return {
    repoPath,
    agentId: agent.id,
    worktreePath: agent.worktreePath,
    sessions,
    selectedSessionPath: selectedSession.path,
    state,
    messages,
  };
});

ipcMain.handle("pi:list-sessions", listPiSessions);
ipcMain.handle("pi:list-repo-sessions", async (_event, repoPath: string, markRecent?: boolean) => listSessionsForRepo(repoPath, markRecent));
ipcMain.handle("pi:delete-session", async (_event, repoPath: string, sessionPath: string) => deletePiSession(repoPath, sessionPath));
ipcMain.handle("pi:get-session-stats", getSessionStats);
ipcMain.handle("pi:get-session-diff", getSessionDiff);
ipcMain.handle("pi:reveal-worktree", () => {
  const agent = requireActiveAgent();
  shell.showItemInFolder(agent.worktreePath);
  return agent.worktreePath;
});
ipcMain.handle("worktrees:list", () => listWorktrees());
ipcMain.handle("worktrees:reveal", async (_event, worktreePath: string) => {
  const indexed = getAllSessionWorktrees().some((worktree) => worktree.worktreePath === worktreePath);

  if (!indexed) {
    throw new Error("Only indexed worktrees can be revealed from this view.");
  }

  shell.showItemInFolder(worktreePath);
  return worktreePath;
});
ipcMain.handle("worktrees:remove-stale", async (_event, sessionPath: string) => removeStaleWorktree(sessionPath));
ipcMain.handle("worktrees:prune-stale", () => pruneStaleWorktrees());
ipcMain.handle("pi:get-commands", getPiCommands);
ipcMain.handle("pi:get-available-models", getAvailableModels);
ipcMain.handle("pi:set-model", async (_event, provider: string, modelId: string) => setPiModel(provider, modelId));
ipcMain.handle("pi:set-thinking-level", async (_event, level: PiThinkingLevel) => {
  await setPiThinkingLevel(level);
});
ipcMain.handle("pi:set-steering-mode", async (_event, mode: PiQueueMode) => {
  await setPiSteeringMode(mode);
  return getSessionState();
});
ipcMain.handle("pi:set-follow-up-mode", async (_event, mode: PiQueueMode) => {
  await setPiFollowUpMode(mode);
  return getSessionState();
});
ipcMain.handle("pi:set-auto-compaction", async (_event, enabled: boolean) => {
  await setPiAutoCompaction(enabled);
  return getSessionState();
});
ipcMain.handle("pi:get-session-snapshot", async () => getStateAndMessages());
ipcMain.handle("pi:get-session-state", getSessionState);

ipcMain.handle("pi:switch-session", async (_event, sessionPath: string) => switchPiSession(sessionPath));

ipcMain.handle("pi:new-session", async (_event, parentSession?: string) => {
  const agent = requireActiveAgent();
  await sendCommand<Extract<RpcResponse, { command: "new_session"; success: true }>>(agent, {
    type: "new_session",
    parentSession,
  });

  const result = await getStateAndMessages(agent);

  if (result.state.sessionFile) {
    agent.selectedSessionPath = result.state.sessionFile;
    recordRepoUsage(agent.repoPath, result.state.sessionFile);
    recordSessionWorktree(agent.repoPath, result.state.sessionFile, agent.worktreePath);
  }

  return {
    ...result,
    agentId: agent.id,
    repoPath: agent.repoPath,
    worktreePath: agent.worktreePath,
  };
});

ipcMain.handle("pi:send-prompt", async (_event, message: string, streamingBehavior?: "steer" | "followUp") => {
  await sendCommand<Extract<RpcResponse, { command: "prompt"; success: true }>>(requireActiveAgent(), {
    type: "prompt",
    message,
    streamingBehavior,
  });
});

ipcMain.handle("pi:send-steer", async (_event, message: string) => {
  await sendCommand<Extract<RpcResponse, { command: "steer"; success: true }>>(requireActiveAgent(), {
    type: "steer",
    message,
  });
});

ipcMain.handle("pi:send-follow-up", async (_event, message: string) => {
  await sendCommand<Extract<RpcResponse, { command: "follow_up"; success: true }>>(requireActiveAgent(), {
    type: "follow_up",
    message,
  });
});

ipcMain.handle("pi:abort", async () => {
  await sendCommand<Extract<RpcResponse, { command: "abort"; success: true }>>(requireActiveAgent(), { type: "abort" });
});

ipcMain.handle("pi:extension-ui-response", async (_event, response: RpcExtensionUIResponse) => {
  await sendExtensionUiResponse(response);
});

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("preferences:get", () => getPreferences());
ipcMain.handle("preferences:set-pi-executable-path", async (_event, executablePath: string) => {
  const nextPath = setPiExecutablePath(executablePath);
  return { piExecutablePath: nextPath };
});
ipcMain.handle("preferences:remove-repo", async (_event, repoPath: string) => {
  await Promise.all([...piAgents.values()].filter((agent) => agent.repoPath === repoPath).map((agent) => stopPiAgent(agent)));

  return removeIndexedRepo(repoPath);
});
ipcMain.handle("preferences:update-desktop-settings", async (_event, settings: Partial<DesktopSettings>) => updateDesktopSettings(settings));
ipcMain.handle("preferences:clear-all-indexed", async () => {
  await stopAllPiAgents();

  return clearAllIndexedData();
});
ipcMain.handle("preferences:reveal-database", () => {
  const databasePath = revealPreferencesDatabase();
  shell.showItemInFolder(databasePath);
  return databasePath;
});

app.whenReady().then(() => {
  nativeTheme.on("updated", () => {
    mainWindow?.setBackgroundColor(getWindowBackgroundColor());
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  void stopAllPiAgents();
  closePreferencesDatabase();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
