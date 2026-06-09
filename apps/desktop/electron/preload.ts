import { contextBridge, ipcRenderer } from "electron";

import type { DesktopPreferences, DesktopSettings } from "@h3code/agent-metadata";

contextBridge.exposeInMainWorld("h3code", {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getAgentServerUrl: () => ipcRenderer.invoke("agent-server:get-url"),
  selectRepo: () => ipcRenderer.invoke("repo:select"),
  revealPath: (targetPath: string) => ipcRenderer.invoke("shell:reveal-path", targetPath),
  revealPreferencesDatabase: () => ipcRenderer.invoke("preferences:reveal-database"),
  getPreferences: () => ipcRenderer.invoke("preferences:get") as Promise<DesktopPreferences>,
  updateDesktopSettings: (settings: Partial<DesktopSettings>) =>
    ipcRenderer.invoke("preferences:updateDesktopSettings", settings) as Promise<DesktopSettings>,
  removeIndexedRepo: (repoPath: string) =>
    ipcRenderer.invoke("preferences:removeRepo", repoPath) as Promise<DesktopPreferences>,
  clearAllIndexedData: () => ipcRenderer.invoke("preferences:clearIndexed") as Promise<DesktopPreferences>,
  setPiExecutablePath: (path: string) =>
    ipcRenderer.invoke("preferences:setPiExecutablePath", path) as Promise<DesktopPreferences>,
});
