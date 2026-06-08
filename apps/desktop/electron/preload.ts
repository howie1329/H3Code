import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("h3code", {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getAgentServerUrl: () => ipcRenderer.invoke("agent-server:get-url"),
  selectRepo: () => ipcRenderer.invoke("repo:select"),
  revealPath: (targetPath: string) => ipcRenderer.invoke("shell:reveal-path", targetPath),
  revealPreferencesDatabase: () => ipcRenderer.invoke("preferences:reveal-database"),
});
