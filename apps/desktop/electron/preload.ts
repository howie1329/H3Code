import { contextBridge, ipcRenderer } from "electron";

type PiEventListener = (event: unknown) => void;
type PiStatusListener = (status: unknown) => void;
type PiExtensionUiRequestListener = (request: unknown) => void;

contextBridge.exposeInMainWorld("h3code", {
  platform: process.platform,
  selectRepo: () => ipcRenderer.invoke("repo:select"),
  connectRepo: (repoPath: string, selectedSessionPath?: string) => ipcRenderer.invoke("pi:connect-repo", repoPath, selectedSessionPath),
  listSessions: () => ipcRenderer.invoke("pi:list-sessions"),
  listRepoSessions: (repoPath: string, markRecent?: boolean) => ipcRenderer.invoke("pi:list-repo-sessions", repoPath, markRecent),
  deletePiSession: (repoPath: string, sessionPath: string) => ipcRenderer.invoke("pi:delete-session", repoPath, sessionPath),
  switchSession: (sessionPath: string) => ipcRenderer.invoke("pi:switch-session", sessionPath),
  newSession: (parentSession?: string) => ipcRenderer.invoke("pi:new-session", parentSession),
  getSessionSnapshot: () => ipcRenderer.invoke("pi:get-session-snapshot"),
  getSessionState: () => ipcRenderer.invoke("pi:get-session-state"),
  getSessionStats: () => ipcRenderer.invoke("pi:get-session-stats"),
  getSessionDiff: () => ipcRenderer.invoke("pi:get-session-diff"),
  getCommands: () => ipcRenderer.invoke("pi:get-commands"),
  getAvailableModels: () => ipcRenderer.invoke("pi:get-available-models"),
  setModel: (provider: string, modelId: string) => ipcRenderer.invoke("pi:set-model", provider, modelId),
  setThinkingLevel: (level: string) => ipcRenderer.invoke("pi:set-thinking-level", level),
  sendPrompt: (message: string, streamingBehavior?: "steer" | "followUp") => ipcRenderer.invoke("pi:send-prompt", message, streamingBehavior),
  sendSteer: (message: string) => ipcRenderer.invoke("pi:send-steer", message),
  sendFollowUp: (message: string) => ipcRenderer.invoke("pi:send-follow-up", message),
  abort: () => ipcRenderer.invoke("pi:abort"),
  respondToExtensionUi: (response: unknown) => ipcRenderer.invoke("pi:extension-ui-response", response),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  removeIndexedRepo: (repoPath: string) => ipcRenderer.invoke("preferences:remove-repo", repoPath),
  updateDesktopSettings: (settings: unknown) => ipcRenderer.invoke("preferences:update-desktop-settings", settings),
  setPiExecutablePath: (executablePath: string) => ipcRenderer.invoke("preferences:set-pi-executable-path", executablePath),
  onPiEvent: (listener: PiEventListener) => {
    const handler = (_event: Electron.IpcRendererEvent, piEvent: unknown) => listener(piEvent);
    ipcRenderer.on("pi:event", handler);
    return () => ipcRenderer.off("pi:event", handler);
  },
  onPiStatus: (listener: PiStatusListener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => listener(status);
    ipcRenderer.on("pi:status", handler);
    return () => ipcRenderer.off("pi:status", handler);
  },
  onExtensionUiRequest: (listener: PiExtensionUiRequestListener) => {
    const handler = (_event: Electron.IpcRendererEvent, request: unknown) => listener(request);
    ipcRenderer.on("pi:extension-ui-request", handler);
    return () => ipcRenderer.off("pi:extension-ui-request", handler);
  },
});
