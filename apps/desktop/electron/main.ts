import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { stat, unlink } from "node:fs/promises";
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
  getPiExecutablePath,
  getPreferences,
  removeIndexedRepo,
  removeIndexedSession,
  recordRepoSessions,
  recordRepoUsage,
  revealPreferencesDatabase,
  setPiExecutablePath,
  updateDesktopSettings,
  type DesktopSettings,
} from "./preferences.js";

type PiConnectionState = "disconnected" | "starting" | "connected" | "exited" | "error";

type PiStatus = {
  state: PiConnectionState;
  repoPath?: string;
  diagnostic?: string;
};

type PiSessionSummary = {
  path: string;
  id: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
};

type ConnectRepoResult = {
  repoPath: string;
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

type PendingRequest = {
  resolve: (response: RpcResponse) => void;
  reject: (error: Error) => void;
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
let piProcess: ChildProcessWithoutNullStreams | undefined;
let selectedRepoPath: string | undefined;
let nextRequestId = 1;
let status: PiStatus = { state: "disconnected" };
let stopReadingStdout: (() => void) | undefined;
const pendingRequests = new Map<string, PendingRequest>();
const maxDiffBytes = 8 * 1024 * 1024;
const RPC_REQUEST_TIMEOUT_MS = 30_000;

let piRpcQueue: Promise<unknown> = Promise.resolve();

function enqueuePiRpc<T>(task: () => Promise<T>): Promise<T> {
  const run = piRpcQueue.then(task, task);
  piRpcQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function resetPiRpcQueue() {
  piRpcQueue = Promise.resolve();
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

function emitSessionEvent(event: SessionEventEnvelope) {
  mainWindow?.webContents.send("pi:session-event", event);
}

function emitDomainEventsFromRaw(raw: unknown) {
  for (const domainEvent of piRpcToDomainEvents(raw)) {
    emitSessionEvent(createSessionEventEnvelope(domainEvent));
  }
}

function emitExtensionUiRequest(request: RpcExtensionUIRequest) {
  mainWindow?.webContents.send("pi:extension-ui-request", request);
}

function rejectPendingRequests(error: Error) {
  for (const request of pendingRequests.values()) {
    request.reject(error);
  }

  pendingRequests.clear();
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
  const sessions = await SessionManager.list(repoPath);
  if (markRecent) {
    recordRepoUsage(repoPath);
  }
  recordRepoSessions(repoPath, sessions);
  return sessions.map(serializeSession);
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
  const sessions = await SessionManager.list(repoPath);
  const session = sessions.find((item) => item.path === sessionPath);

  if (!session) {
    throw new Error("Session does not belong to this repo.");
  }

  if (selectedRepoPath === repoPath && sessionPath === await getActiveSessionPath()) {
    await stopPiProcess();
    selectedRepoPath = undefined;
    emitStatus({ state: "disconnected" });
  }

  await deleteSessionFile(sessionPath);
  removeIndexedSession(sessionPath);

  return listSessionsForRepo(repoPath, true);
}

async function getActiveSessionPath() {
  if (!piProcess || status.state !== "connected") {
    return undefined;
  }

  const { state } = await getStateAndMessages();
  return state.sessionFile;
}

async function listPiSessions() {
  if (!selectedRepoPath) {
    throw new Error("Select a repo before listing sessions.");
  }

  return listSessionsForRepo(selectedRepoPath, true);
}

async function getSessionDiff(): Promise<SessionDiff> {
  if (!selectedRepoPath) {
    return { patch: "", changedFiles: 0 };
  }

  await assertDirectory(selectedRepoPath);

  const repoCheck = await runGit(["rev-parse", "--is-inside-work-tree"], selectedRepoPath);

  if (repoCheck.status !== 0 || repoCheck.stdout.trim() !== "true") {
    return { patch: "", changedFiles: 0 };
  }

  const trackedDiff = await runGit(["diff", "HEAD", "--no-ext-diff", "--no-color", "--binary"], selectedRepoPath);
  const untrackedFiles = await getUntrackedFiles(selectedRepoPath);
  const patches = trackedDiff.stdout ? [trackedDiff.stdout] : [];
  let patchBytes = trackedDiff.stdout.length;

  for (const file of untrackedFiles) {
    const fileDiff = await getUntrackedFileDiff(selectedRepoPath, file);

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

async function stopPiProcess() {
  if (!piProcess) {
    return;
  }

  const processToStop = piProcess;
  piProcess = undefined;
  stopReadingStdout?.();
  stopReadingStdout = undefined;
  processToStop.removeAllListeners();
  processToStop.stdout.removeAllListeners();
  processToStop.stderr.removeAllListeners();
  processToStop.kill();
  rejectPendingRequests(new Error("PI RPC process stopped."));
  resetPiRpcQueue();
}

async function startPiProcess(repoPath: string) {
  await stopPiProcess();
  await assertDirectory(repoPath);

  selectedRepoPath = repoPath;
  emitStatus({ state: "starting", repoPath });

  const piExecutable = getPiExecutablePath();
  piProcess = spawn(piExecutable, ["--mode", "rpc"], {
    cwd: repoPath,
    env: process.env,
  });

  stopReadingStdout?.();
  stopReadingStdout = attachJsonlLineReader(piProcess.stdout, (line: string) => {
    try {
      handleRpcMessage(JSON.parse(line) as RpcResponse | unknown);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitStatus({
        state: "error",
        repoPath: selectedRepoPath,
        diagnostic: `Malformed PI RPC JSON: ${message}`,
      });
    }
  });

  piProcess.stderr.setEncoding("utf8");
  piProcess.stderr.on("data", (chunk: string) => {
    const diagnostic = chunk.trim();

    if (diagnostic) {
      emitStatus({ state: status.state, repoPath, diagnostic });
    }
  });

  piProcess.on("error", (error) => {
    rejectPendingRequests(error);
    emitStatus({ state: "error", repoPath, diagnostic: error.message });
  });

  piProcess.on("exit", (code, signal) => {
    const diagnostic = `PI exited${code === null ? "" : ` with code ${code}`}${signal ? ` (${signal})` : ""}.`;
    piProcess = undefined;
    rejectPendingRequests(new Error(diagnostic));
    emitStatus({ state: "exited", repoPath, diagnostic });
  });
}

async function ensurePiHandshake(repoPath: string) {
  await sendCommand<Extract<RpcResponse, { command: "get_state"; success: true }>>({ type: "get_state" });
  emitStatus({ state: "connected", repoPath });
}

function handleRpcMessage(message: RpcResponse | unknown) {
  if (isRpcResponse(message)) {
    const pending = message.id ? pendingRequests.get(message.id) : undefined;

    if (pending && message.id) {
      pendingRequests.delete(message.id);
      pending.resolve(message);
      return;
    }

    if (message.id) {
      const command = "command" in message && typeof message.command === "string" ? message.command : "unknown";
      emitStatus({
        state: status.state,
        repoPath: selectedRepoPath,
        diagnostic: `Unexpected PI RPC response for ${command} (${message.id}).`,
      });
      return;
    }
  }

  if (isExtensionUiRequest(message)) {
    handleExtensionUiRequest(message);
    return;
  }

  emitDomainEventsFromRaw(message);
}

function isExtensionUiRequest(message: unknown): message is RpcExtensionUIRequest {
  return Boolean(message && typeof message === "object" && "type" in message && message.type === "extension_ui_request");
}

function handleExtensionUiRequest(request: RpcExtensionUIRequest) {
  if (
    request.method === "notify" ||
    request.method === "setStatus" ||
    request.method === "setWidget" ||
    request.method === "setTitle"
  ) {
    emitDomainEventsFromRaw(request);
    return;
  }

  emitExtensionUiRequest(request);
}

async function sendExtensionUiResponse(response: RpcExtensionUIResponse) {
  return enqueuePiRpc(async () => {
    writeExtensionUiResponse(response);
  });
}

function writeExtensionUiResponse(response: RpcExtensionUIResponse) {
  if (!piProcess || !piProcess.stdin.writable) {
    throw new Error("PI RPC is not connected.");
  }

  const id = `h3code-${nextRequestId++}`;
  piProcess.stdin.write(serializeJsonLine({ ...response, id }));
}

function isRpcResponse(message: unknown): message is RpcResponse {
  return Boolean(message && typeof message === "object" && "type" in message && message.type === "response");
}

async function sendCommand<T extends RpcResponse>(command: RpcCommand): Promise<T> {
  return enqueuePiRpc(() => sendCommandImmediate<T>(command));
}

function sendCommandImmediate<T extends RpcResponse>(command: RpcCommand): Promise<T> {
  if (!piProcess || !piProcess.stdin.writable) {
    return Promise.reject(new Error("PI RPC is not connected."));
  }

  const id = `h3code-${nextRequestId++}`;
  const commandWithId = { ...command, id };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Timeout waiting for response to ${command.type}.`));
    }, RPC_REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, {
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

    piProcess?.stdin.write(serializeJsonLine(commandWithId), (error) => {
      if (!error) {
        return;
      }

      clearTimeout(timeout);
      pendingRequests.delete(id);
      reject(error);
    });
  });
}

async function getSessionState() {
  const stateResponse = await sendCommand<Extract<RpcResponse, { command: "get_state"; success: true }>>({ type: "get_state" });
  return stateResponse.data;
}

async function getStateAndMessages(): Promise<SessionSnapshot> {
  const stateResponse = await sendCommand<Extract<RpcResponse, { command: "get_state"; success: true }>>({ type: "get_state" });
  const messagesResponse = await sendCommand<Extract<RpcResponse, { command: "get_messages"; success: true }>>({ type: "get_messages" });

  return {
    state: stateResponse.data,
    messages: messagesResponse.data.messages as unknown[],
  };
}

async function getSessionStats() {
  const response = await sendCommand<Extract<RpcResponse, { command: "get_session_stats"; success: true }>>({ type: "get_session_stats" });
  return response.data;
}

async function getPiCommands() {
  const response = await sendCommand<Extract<RpcResponse, { command: "get_commands"; success: true }>>({ type: "get_commands" });
  return response.data.commands.map(normalizeSlashCommand);
}

async function getAvailableModels() {
  const response = await sendCommand<Extract<RpcResponse, { command: "get_available_models"; success: true }>>({
    type: "get_available_models",
  });
  return response.data.models;
}

async function setPiModel(provider: string, modelId: string) {
  const response = await sendCommand<Extract<RpcResponse, { command: "set_model"; success: true }>>({
    type: "set_model",
    provider,
    modelId,
  });
  return response.data;
}

type PiThinkingLevel = Extract<RpcCommand, { type: "set_thinking_level" }>["level"];

async function setPiThinkingLevel(level: PiThinkingLevel) {
  await sendCommand<Extract<RpcResponse, { command: "set_thinking_level"; success: true }>>({
    type: "set_thinking_level",
    level,
  });
}

type PiQueueMode = Extract<RpcCommand, { type: "set_steering_mode" }>["mode"];

async function setPiSteeringMode(mode: PiQueueMode) {
  await sendCommand<Extract<RpcResponse, { command: "set_steering_mode"; success: true }>>({
    type: "set_steering_mode",
    mode,
  });
}

async function setPiFollowUpMode(mode: PiQueueMode) {
  await sendCommand<Extract<RpcResponse, { command: "set_follow_up_mode"; success: true }>>({
    type: "set_follow_up_mode",
    mode,
  });
}

async function setPiAutoCompaction(enabled: boolean) {
  await sendCommand<Extract<RpcResponse, { command: "set_auto_compaction"; success: true }>>({
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
  await sendCommand<Extract<RpcResponse, { command: "switch_session"; success: true }>>({
    type: "switch_session",
    sessionPath,
  });

  if (selectedRepoPath) {
    recordRepoUsage(selectedRepoPath, sessionPath);
  }

  return getStateAndMessages();
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
  await startPiProcess(repoPath);
  await ensurePiHandshake(repoPath);

  const sessions = await listPiSessions();
  const selectedSession = sessions.find((session) => session.path === selectedSessionPath) ?? sessions[0];

  if (!selectedSession) {
    return { repoPath, sessions };
  }

  const { state, messages } = await switchPiSession(selectedSession.path);

  return {
    repoPath,
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
ipcMain.handle("pi:get-session-snapshot", getStateAndMessages);
ipcMain.handle("pi:get-session-state", getSessionState);

ipcMain.handle("pi:switch-session", async (_event, sessionPath: string) => switchPiSession(sessionPath));

ipcMain.handle("pi:new-session", async (_event, parentSession?: string) => {
  await sendCommand<Extract<RpcResponse, { command: "new_session"; success: true }>>({
    type: "new_session",
    parentSession,
  });

  const result = await getStateAndMessages();

  if (selectedRepoPath && result.state.sessionFile) {
    recordRepoUsage(selectedRepoPath, result.state.sessionFile);
  }

  return result;
});

ipcMain.handle("pi:send-prompt", async (_event, message: string, streamingBehavior?: "steer" | "followUp") => {
  await sendCommand<Extract<RpcResponse, { command: "prompt"; success: true }>>({
    type: "prompt",
    message,
    streamingBehavior,
  });
});

ipcMain.handle("pi:send-steer", async (_event, message: string) => {
  await sendCommand<Extract<RpcResponse, { command: "steer"; success: true }>>({
    type: "steer",
    message,
  });
});

ipcMain.handle("pi:send-follow-up", async (_event, message: string) => {
  await sendCommand<Extract<RpcResponse, { command: "follow_up"; success: true }>>({
    type: "follow_up",
    message,
  });
});

ipcMain.handle("pi:abort", async () => {
  await sendCommand<Extract<RpcResponse, { command: "abort"; success: true }>>({ type: "abort" });
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
  if (selectedRepoPath === repoPath) {
    await stopPiProcess();
    selectedRepoPath = undefined;
    emitStatus({ state: "disconnected" });
  }

  return removeIndexedRepo(repoPath);
});
ipcMain.handle("preferences:update-desktop-settings", async (_event, settings: Partial<DesktopSettings>) => updateDesktopSettings(settings));
ipcMain.handle("preferences:clear-all-indexed", async () => {
  if (selectedRepoPath) {
    await stopPiProcess();
    selectedRepoPath = undefined;
    emitStatus({ state: "disconnected" });
  }

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
  void stopPiProcess();
  closePreferencesDatabase();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
