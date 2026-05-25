import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SessionManager, type RpcCommand, type RpcResponse, type RpcSessionState, type SessionInfo } from "@earendil-works/pi-coding-agent";
import {
  closePreferencesDatabase,
  getPreferences,
  recordRepoSessions,
  recordRepoUsage,
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

type PendingRequest = {
  resolve: (response: RpcResponse) => void;
  reject: (error: Error) => void;
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

let mainWindow: BrowserWindow | undefined;
let piProcess: ChildProcessWithoutNullStreams | undefined;
let selectedRepoPath: string | undefined;
let stdoutBuffer = "";
let nextRequestId = 1;
let status: PiStatus = { state: "disconnected" };
const pendingRequests = new Map<string, PendingRequest>();

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "H3Code",
    backgroundColor: getWindowBackgroundColor(),
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

function emitEvent(event: unknown) {
  mainWindow?.webContents.send("pi:event", event);
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

async function listPiSessions() {
  if (!selectedRepoPath) {
    throw new Error("Select a repo before listing sessions.");
  }

  return listSessionsForRepo(selectedRepoPath, true);
}

async function stopPiProcess() {
  if (!piProcess) {
    return;
  }

  const processToStop = piProcess;
  piProcess = undefined;
  stdoutBuffer = "";
  processToStop.removeAllListeners();
  processToStop.stdout.removeAllListeners();
  processToStop.stderr.removeAllListeners();
  processToStop.kill();
  rejectPendingRequests(new Error("PI RPC process stopped."));
}

async function startPiProcess(repoPath: string) {
  await stopPiProcess();
  await assertDirectory(repoPath);

  selectedRepoPath = repoPath;
  stdoutBuffer = "";
  emitStatus({ state: "starting", repoPath });

  piProcess = spawn("pi", ["--mode", "rpc"], {
    cwd: repoPath,
    env: process.env,
  });

  piProcess.stdout.setEncoding("utf8");
  piProcess.stdout.on("data", handleStdout);

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

  emitStatus({ state: "connected", repoPath });
}

function handleStdout(chunk: string) {
  stdoutBuffer += chunk;

  while (true) {
    const newlineIndex = stdoutBuffer.indexOf("\n");

    if (newlineIndex === -1) {
      return;
    }

    const rawLine = stdoutBuffer.slice(0, newlineIndex);
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

    if (!line.trim()) {
      continue;
    }

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
  }
}

function handleRpcMessage(message: RpcResponse | unknown) {
  if (isRpcResponse(message)) {
    const pending = message.id ? pendingRequests.get(message.id) : undefined;

    if (pending && message.id) {
      pendingRequests.delete(message.id);
      pending.resolve(message);
      return;
    }
  }

  emitEvent(message);
}

function isRpcResponse(message: unknown): message is RpcResponse {
  return Boolean(message && typeof message === "object" && "type" in message && message.type === "response");
}

async function sendCommand<T extends RpcResponse>(command: RpcCommand): Promise<T> {
  if (!piProcess || !piProcess.stdin.writable) {
    throw new Error("PI RPC is not connected.");
  }

  const id = `h3code-${nextRequestId++}`;
  const commandWithId = { ...command, id };

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: (response) => {
        if (!response.success) {
          reject(new Error(response.error));
          return;
        }

        resolve(response as T);
      },
      reject,
    });

    piProcess?.stdin.write(`${JSON.stringify(commandWithId)}\n`, (error) => {
      if (!error) {
        return;
      }

      pendingRequests.delete(id);
      reject(error);
    });
  });
}

async function getStateAndMessages() {
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

ipcMain.handle("pi:connect-repo", async (_event, repoPath: string, selectedSessionPath?: string): Promise<ConnectRepoResult> => {
  await startPiProcess(repoPath);

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
ipcMain.handle("pi:get-session-stats", getSessionStats);
ipcMain.handle("pi:get-commands", getPiCommands);

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

ipcMain.handle("pi:abort", async () => {
  await sendCommand<Extract<RpcResponse, { command: "abort"; success: true }>>({ type: "abort" });
});

ipcMain.handle("preferences:get", () => getPreferences());
ipcMain.handle("preferences:update-desktop-settings", async (_event, settings: Partial<DesktopSettings>) => updateDesktopSettings(settings));

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
