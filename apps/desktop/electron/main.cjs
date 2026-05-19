const { app, BrowserWindow, ipcMain } = require('electron');
const { constants } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const rendererUrl = process.env.H3CODE_RENDERER_URL || 'http://127.0.0.1:5173';
const defaultSettings = {
  piExecutablePath: ''
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function readSettings() {
  try {
    const contents = await fs.readFile(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(contents);

    return {
      piExecutablePath:
        typeof parsed.piExecutablePath === 'string' ? parsed.piExecutablePath : defaultSettings.piExecutablePath
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...defaultSettings };
    }

    throw error;
  }
}

async function writeSettings(settings) {
  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  await fs.writeFile(getSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

async function validatePiExecutablePath(piExecutablePath) {
  const normalizedPath = piExecutablePath.trim();

  if (!normalizedPath) {
    return {
      status: 'missing',
      message: 'Set the Pi executable path before sending prompts.'
    };
  }

  let stats;

  try {
    stats = await fs.stat(normalizedPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        status: 'nonexistent',
        message: 'No file exists at this path.'
      };
    }

    throw error;
  }

  if (!stats.isFile()) {
    return {
      status: 'non-file',
      message: 'The Pi executable path must point to a file.'
    };
  }

  try {
    await fs.access(normalizedPath, constants.X_OK);
  } catch {
    return {
      status: 'non-executable',
      message: 'This file is not executable.'
    };
  }

  return {
    status: 'valid',
    message: 'Pi executable path is ready.'
  };
}

async function getSettingsState(settings = null) {
  const currentSettings = settings ?? (await readSettings());
  const validation = await validatePiExecutablePath(currentSettings.piExecutablePath);

  return {
    settings: currentSettings,
    validation
  };
}

function registerIpcHandlers() {
  ipcMain.handle('settings:get', async () => getSettingsState());

  ipcMain.handle('settings:update', async (_event, input) => {
    const settings = {
      piExecutablePath:
        typeof input?.piExecutablePath === 'string' ? input.piExecutablePath.trim() : defaultSettings.piExecutablePath
    };

    await writeSettings(settings);
    return getSettingsState(settings);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f1115',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL(rendererUrl);
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
