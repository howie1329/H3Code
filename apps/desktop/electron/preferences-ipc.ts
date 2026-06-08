import { ipcMain } from "electron";

import {
  clearAllIndexedData,
  getIndexedSessionsForRepo,
  getPreferences,
  recordRepoUsage,
  removeIndexedRepo,
  setPiExecutablePath,
  updateDesktopSettings,
  type DesktopSettings,
} from "./preferences.js";

export function registerPreferencesIpc() {
  ipcMain.handle("preferences:get", () => getPreferences());

  ipcMain.handle("preferences:updateDesktopSettings", (_event, settings: Partial<DesktopSettings>) => {
    updateDesktopSettings(settings);
    return getPreferences().desktopSettings;
  });

  ipcMain.handle("preferences:removeRepo", (_event, repoPath: string) => {
    removeIndexedRepo(repoPath);
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

  ipcMain.handle("preferences:listRepoSessions", (_event, repoPath: string, markRecent = false) => {
    if (markRecent) {
      recordRepoUsage(repoPath);
    }

    return getIndexedSessionsForRepo(repoPath);
  });
}
