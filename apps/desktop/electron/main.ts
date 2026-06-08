import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getAgentServerUrl,
  startAgentServerProcess,
  stopAgentServerProcess,
} from "./agent-server-lifecycle.js";
import { registerPreferencesIpc } from "./preferences-ipc.js";
import { closePreferencesDatabase, revealPreferencesDatabase } from "./preferences.js";

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
  } else {
    void window.loadFile(path.join(__dirname, "../build/index.html"));
  }
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

ipcMain.handle("shell:reveal-path", (_event, targetPath: string) => {
  shell.showItemInFolder(targetPath);
  return targetPath;
});

ipcMain.handle("agent-server:get-url", () => getAgentServerUrl());

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("preferences:reveal-database", () => {
  const databasePath = revealPreferencesDatabase();
  shell.showItemInFolder(databasePath);
  return databasePath;
});

app.whenReady().then(async () => {
  registerPreferencesIpc();
  await startAgentServerProcess();

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
  void stopAgentServerProcess();
  closePreferencesDatabase();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
