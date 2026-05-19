const { app, BrowserWindow, ipcMain } = require('electron');
const { constants } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const rendererUrl = process.env.H3CODE_RENDERER_URL || 'http://127.0.0.1:5173';
const metadataSchemaVersion = 1;
const defaultSettings = {
  piExecutablePath: ''
};
const defaultMetadata = {
  schemaVersion: metadataSchemaVersion,
  repos: [],
  sessions: [],
  settings: defaultSettings
};

function getMetadataPath() {
  return path.join(app.getPath('userData'), 'h3-metadata.json');
}

function getLegacySettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function sanitizeSettings(input) {
  return {
    piExecutablePath:
      typeof input?.piExecutablePath === 'string' ? input.piExecutablePath.trim() : defaultSettings.piExecutablePath
  };
}

function sanitizeRepo(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  if (
    typeof input.id !== 'string' ||
    typeof input.name !== 'string' ||
    typeof input.path !== 'string' ||
    typeof input.addedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: input.id,
    name: input.name,
    path: input.path,
    addedAt: input.addedAt,
    ...(typeof input.lastOpenedAt === 'string' ? { lastOpenedAt: input.lastOpenedAt } : {})
  };
}

function sanitizeSession(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  if (
    typeof input.id !== 'string' ||
    typeof input.repoId !== 'string' ||
    input.harness !== 'pi' ||
    typeof input.harnessSessionPath !== 'string' ||
    typeof input.title !== 'string' ||
    typeof input.createdAt !== 'string' ||
    typeof input.updatedAt !== 'string' ||
    !['idle', 'running', 'error'].includes(input.status)
  ) {
    return null;
  }

  return {
    id: input.id,
    repoId: input.repoId,
    harness: 'pi',
    harnessSessionPath: input.harnessSessionPath,
    title: input.title,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    status: input.status === 'running' ? 'idle' : input.status
  };
}

function sanitizeMetadata(input) {
  const root = input && typeof input === 'object' ? input : {};

  return {
    schemaVersion: metadataSchemaVersion,
    repos: Array.isArray(root.repos) ? root.repos.map(sanitizeRepo).filter(Boolean) : [],
    sessions: Array.isArray(root.sessions) ? root.sessions.map(sanitizeSession).filter(Boolean) : [],
    settings: sanitizeSettings(root.settings)
  };
}

async function readLegacySettings() {
  try {
    const contents = await fs.readFile(getLegacySettingsPath(), 'utf8');
    return sanitizeSettings(JSON.parse(contents));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return { ...defaultSettings };
    }

    throw error;
  }
}

async function preserveCorruptMetadata() {
  const metadataPath = getMetadataPath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const corruptPath = path.join(path.dirname(metadataPath), `h3-metadata.corrupt-${timestamp}.json`);

  await fs.rename(metadataPath, corruptPath);
}

async function readMetadata() {
  try {
    const contents = await fs.readFile(getMetadataPath(), 'utf8');
    const parsed = JSON.parse(contents);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      await preserveCorruptMetadata();
      return { ...defaultMetadata, settings: { ...defaultSettings } };
    }

    return sanitizeMetadata(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...defaultMetadata, settings: await readLegacySettings() };
    }

    if (error instanceof SyntaxError) {
      await preserveCorruptMetadata();
      return { ...defaultMetadata, settings: { ...defaultSettings } };
    }

    throw error;
  }
}

async function writeMetadata(metadata) {
  const metadataPath = getMetadataPath();
  const tempPath = `${metadataPath}.tmp`;
  const sanitized = sanitizeMetadata(metadata);

  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, metadataPath);
}

async function readSettings() {
  const metadata = await readMetadata();
  return metadata.settings;
}

async function writeSettings(settings) {
  const metadata = await readMetadata();
  await writeMetadata({
    ...metadata,
    settings
  });
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
  ipcMain.handle('metadata:get', async () => readMetadata());

  ipcMain.handle('settings:get', async () => getSettingsState());

  ipcMain.handle('settings:update', async (_event, input) => {
    const settings = sanitizeSettings(input);

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
