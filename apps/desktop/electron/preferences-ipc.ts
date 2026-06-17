import { ipcMain } from "electron";

import {
  clearAllIndexedData,
  getPreferences,
  getSessionUiMessages,
  removeIndexedRepo,
  removeIndexedSession,
  saveSessionUiMessages,
  setPiExecutablePath,
  updateDesktopSettings,
  type DesktopSettings,
  type SessionUiMessage,
} from "./preferences.js";

export function registerPreferencesIpc() {
  ipcMain.handle("preferences:get", () => getPreferences());

  ipcMain.handle("preferences:getSessionUiMessages", (_event, sessionId: string) => {
    return getSessionUiMessages(sessionId);
  });

  ipcMain.handle(
    "preferences:saveSessionUiMessages",
    (_event, sessionId: string, messages: SessionUiMessage[]) => {
      saveSessionUiMessages(sessionId, messages);
    },
  );

  ipcMain.handle("preferences:updateDesktopSettings", (_event, settings: Partial<DesktopSettings>) => {
    updateDesktopSettings(settings);
    return getPreferences().desktopSettings;
  });

  ipcMain.handle("preferences:removeRepo", (_event, repoPath: string) => {
    removeIndexedRepo(repoPath);
    return getPreferences();
  });

  ipcMain.handle("preferences:removeSession", (_event, sessionId: string) => {
    removeIndexedSession(sessionId);
    return getPreferences();
  });

  ipcMain.handle("preferences:clearIndexed", () => {
    clearAllIndexedData();
    return getPreferences();
  });

  ipcMain.handle("preferences:setPiExecutablePath", (_event, path: string) => {
    setPiExecutablePath(path);
    return getPreferences();
  });
}
