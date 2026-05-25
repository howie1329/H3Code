import { contextBridge, ipcRenderer } from "electron";

type PiEventListener = (event: unknown) => void;
type PiStatusListener = (status: unknown) => void;

contextBridge.exposeInMainWorld("h3code", {
  platform: process.platform,
  selectRepo: () => ipcRenderer.invoke("repo:select"),
  connectRepo: (repoPath: string, selectedSessionPath?: string) => ipcRenderer.invoke("pi:connect-repo", repoPath, selectedSessionPath),
  listSessions: () => ipcRenderer.invoke("pi:list-sessions"),
  listRepoSessions: (repoPath: string, markRecent?: boolean) => ipcRenderer.invoke("pi:list-repo-sessions", repoPath, markRecent),
  switchSession: (sessionPath: string) => ipcRenderer.invoke("pi:switch-session", sessionPath),
  newSession: (parentSession?: string) => ipcRenderer.invoke("pi:new-session", parentSession),
  getSessionStats: () => ipcRenderer.invoke("pi:get-session-stats"),
  getCommands: () => ipcRenderer.invoke("pi:get-commands"),
  sendPrompt: (message: string, streamingBehavior?: "steer" | "followUp") => ipcRenderer.invoke("pi:send-prompt", message, streamingBehavior),
  abort: () => ipcRenderer.invoke("pi:abort"),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  updateDesktopSettings: (settings: unknown) => ipcRenderer.invoke("preferences:update-desktop-settings", settings),
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
});
