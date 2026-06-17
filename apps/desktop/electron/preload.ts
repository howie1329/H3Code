import { contextBridge, ipcRenderer } from "electron";

import type { DesktopPreferences, DesktopSettings, SessionUiMessage } from "@h3code/agent-metadata";

contextBridge.exposeInMainWorld("h3code", {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getAgentStreamUrl: () => ipcRenderer.invoke("agent:get-stream-url"),
  selectRepo: () => ipcRenderer.invoke("repo:select"),
  revealPath: (targetPath: string) => ipcRenderer.invoke("shell:reveal-path", targetPath),
  revealPreferencesDatabase: () => ipcRenderer.invoke("preferences:reveal-database"),
  getPreferences: () => ipcRenderer.invoke("preferences:get") as Promise<DesktopPreferences>,
  updateDesktopSettings: (settings: Partial<DesktopSettings>) =>
    ipcRenderer.invoke("preferences:updateDesktopSettings", settings) as Promise<DesktopSettings>,
  removeIndexedRepo: (repoPath: string) =>
    ipcRenderer.invoke("preferences:removeRepo", repoPath) as Promise<DesktopPreferences>,
  removeIndexedSession: (sessionId: string) =>
    ipcRenderer.invoke("preferences:removeSession", sessionId) as Promise<DesktopPreferences>,
  getSessionUiMessages: (sessionId: string) =>
    ipcRenderer.invoke("preferences:getSessionUiMessages", sessionId) as Promise<SessionUiMessage[] | undefined>,
  saveSessionUiMessages: (sessionId: string, messages: SessionUiMessage[]) =>
    ipcRenderer.invoke("preferences:saveSessionUiMessages", sessionId, messages),
  clearAllIndexedData: () => ipcRenderer.invoke("preferences:clearIndexed") as Promise<DesktopPreferences>,
  setPiExecutablePath: (path: string) =>
    ipcRenderer.invoke("preferences:setPiExecutablePath", path) as Promise<DesktopPreferences>,
});
