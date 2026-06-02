import type { SessionMessageCacheUpsert } from "@h3code/agent-metadata";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("h3code", {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getAgentServerUrl: () => ipcRenderer.invoke("agent-server:get-url"),
  selectRepo: () => ipcRenderer.invoke("repo:select"),
  revealPath: (targetPath: string) => ipcRenderer.invoke("shell:reveal-path", targetPath),
  revealPreferencesDatabase: () => ipcRenderer.invoke("preferences:reveal-database"),
  getSessionMessageCache: (sessionPath: string) => ipcRenderer.invoke("session-cache:get", sessionPath),
  upsertSessionMessageCache: (input: SessionMessageCacheUpsert) =>
    ipcRenderer.invoke("session-cache:upsert", input),
  deleteSessionMessageCache: (sessionPath: string) =>
    ipcRenderer.invoke("session-cache:delete", sessionPath),
});
