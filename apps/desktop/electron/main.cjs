const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const { constants } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const execFileAsync = promisify(execFile);

const rendererUrl = process.env.H3CODE_RENDERER_URL || 'http://127.0.0.1:5173';
const metadataSchemaVersion = 1;
const defaultSettings = {
  piExecutablePath: ''
};
const defaultMetadata = {
  schemaVersion: metadataSchemaVersion,
  selectedRepoId: '',
  repos: [],
  sessions: [],
  settings: defaultSettings
};

const runningProcesses = new Map();

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
    ...(typeof input.lastOpenedAt === 'string' ? { lastOpenedAt: input.lastOpenedAt } : {}),
    ...(typeof input.selectedSessionId === 'string' ? { selectedSessionId: input.selectedSessionId } : {})
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
    status: input.status,
    titleSource: ['local', 'pi', 'user'].includes(input.titleSource) ? input.titleSource : 'local'
  };
}

function sanitizeMetadata(input) {
  const root = input && typeof input === 'object' ? input : {};

  return {
    schemaVersion: metadataSchemaVersion,
    selectedRepoId: typeof root.selectedRepoId === 'string' ? root.selectedRepoId : '',
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

async function isValidPiExecutablePath(candidatePath) {
  const validation = await validatePiExecutablePath(candidatePath);
  return validation.status === 'valid';
}

async function detectPiOnPath() {
  const command = process.platform === 'win32' ? 'where' : 'sh';
  const args = process.platform === 'win32' ? ['pi'] : ['-lc', 'command -v pi'];

  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 3000 });
    const candidatePath = stdout.split(/\r?\n/).find(Boolean)?.trim();

    if (candidatePath && (await isValidPiExecutablePath(candidatePath))) {
      return { path: candidatePath, source: 'path' };
    }

    return candidatePath ? { invalidCandidateFound: true } : null;
  } catch {
    return null;
  }
}

async function collectNvmPiCandidates(homeDirectory) {
  const nodeVersionsPath = path.join(homeDirectory, '.nvm', 'versions', 'node');

  try {
    const entries = await fs.readdir(nodeVersionsPath, { withFileTypes: true });
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const candidatePath = path.join(nodeVersionsPath, entry.name, 'bin', 'pi');

          try {
            const stats = await fs.stat(candidatePath);
            return { path: candidatePath, source: 'nvm', mtimeMs: stats.mtimeMs };
          } catch {
            return null;
          }
        })
    );

    return candidates.filter(Boolean).sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

async function detectPiExecutable() {
  let invalidCandidateFound = false;
  const pathResult = await detectPiOnPath();

  if (pathResult?.path) return ok(pathResult);
  if (pathResult?.invalidCandidateFound) invalidCandidateFound = true;

  const homeDirectory = app.getPath('home');
  const candidates = [
    ...(await collectNvmPiCandidates(homeDirectory)),
    { path: path.join(homeDirectory, '.local', 'bin', 'pi'), source: 'local-bin' },
    { path: path.join(homeDirectory, 'Library', 'pnpm', 'pi'), source: 'pnpm' },
    { path: '/opt/homebrew/bin/pi', source: 'homebrew' },
    { path: '/usr/local/bin/pi', source: 'system' },
    { path: '/usr/bin/pi', source: 'system' }
  ];

  for (const candidate of candidates) {
    try {
      const exists = await fs.stat(candidate.path);
      if (!exists.isFile()) {
        invalidCandidateFound = true;
        continue;
      }

      if (await isValidPiExecutablePath(candidate.path)) {
        return ok({ path: candidate.path, source: candidate.source });
      }

      invalidCandidateFound = true;
    } catch {
      // Missing candidates are expected during detection.
    }
  }

  if (invalidCandidateFound) {
    return fail('pi_candidates_invalid', 'Found Pi candidates, but none were executable.');
  }

  return fail('pi_not_found', 'Could not find Pi automatically. Enter the executable path manually.');
}

function ok(data) {
  return { ok: true, data };
}

function fail(code, message) {
  return { ok: false, error: { code, message } };
}

function requireObject(input, label = 'Input') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return `${label} must be an object.`;
  }

  return null;
}

function requireNonEmptyString(input, field) {
  if (typeof input?.[field] !== 'string' || input[field].trim().length === 0) {
    return `${field} is required.`;
  }

  return null;
}

function findRepo(metadata, repoId) {
  return metadata.repos.find((repo) => repo.id === repoId) ?? null;
}

function findSession(metadata, sessionId) {
  return metadata.sessions.find((session) => session.id === sessionId) ?? null;
}

function getTranscriptPath(sessionId) {
  return path.join(app.getPath('userData'), 'transcripts', `${sessionId}.jsonl`);
}

async function appendTranscriptEvent(sessionId, event) {
  const transcriptPath = getTranscriptPath(sessionId);
  const entry = { id: randomUUID(), sessionId, createdAt: new Date().toISOString(), ...event };
  await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
  await fs.appendFile(transcriptPath, `${JSON.stringify(entry)}\n`, 'utf8');
  broadcast('sessions:transcriptEvent', entry);
  return entry;
}

async function readTranscriptEvents(sessionId) {
  try {
    const contents = await fs.readFile(getTranscriptPath(sessionId), 'utf8');
    return contents
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

async function updateSession(sessionId, updater) {
  const metadata = await readMetadata();
  const session = findSession(metadata, sessionId);
  if (!session) return null;
  const updatedSession = { ...session, ...updater(session), updatedAt: new Date().toISOString() };
  await writeMetadata({
    ...metadata,
    sessions: metadata.sessions.map((item) => (item.id === sessionId ? updatedSession : item))
  });
  broadcast('sessions:updated', updatedSession);
  return updatedSession;
}

function derivePromptTitle(prompt) {
  const collapsed = prompt.replace(/\s+/g, ' ').trim();
  if (!collapsed) return 'New session';
  return collapsed.length > 60 ? `${collapsed.slice(0, 57)}...` : collapsed;
}

function sortRepos(repos) {
  return [...repos].sort((a, b) => {
    const aDate = a.lastOpenedAt ?? a.addedAt;
    const bDate = b.lastOpenedAt ?? b.addedAt;
    return bDate.localeCompare(aDate);
  });
}

async function validateRepoDirectory(repoPath) {
  let stats;

  try {
    stats = await fs.stat(repoPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fail('repo_path_not_found', 'No directory exists at this repository path.');
    }

    throw error;
  }

  if (!stats.isDirectory()) {
    return fail('repo_path_not_directory', 'Repository path must point to a directory.');
  }

  return ok(null);
}


function attachRpcJsonlReader(child, runningProcess) {
  child.stdout.on('data', (chunk) => {
    runningProcess.stdoutBuffer += chunk.toString('utf8');

    while (true) {
      const newlineIndex = runningProcess.stdoutBuffer.indexOf('\n');
      if (newlineIndex === -1) break;

      let line = runningProcess.stdoutBuffer.slice(0, newlineIndex);
      runningProcess.stdoutBuffer = runningProcess.stdoutBuffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.trim()) continue;

      void handleRpcLine(runningProcess, line);
    }
  });

  child.stdout.on('end', () => {
    const line = runningProcess.stdoutBuffer.endsWith('\r')
      ? runningProcess.stdoutBuffer.slice(0, -1)
      : runningProcess.stdoutBuffer;
    runningProcess.stdoutBuffer = '';
    if (line.trim()) void handleRpcLine(runningProcess, line);
  });
}

async function handleRpcLine(runningProcess, line) {
  let payload;

  try {
    payload = JSON.parse(line);
  } catch {
    await appendTranscriptEvent(runningProcess.sessionId, {
      type: 'stderr',
      stream: 'stdout',
      content: `Invalid Pi RPC JSON: ${line}`
    });
    return;
  }

  if (payload.type === 'agent_start') runningProcess.isStreaming = true;
  if (payload.type === 'agent_end') runningProcess.isStreaming = false;

  await appendTranscriptEvent(runningProcess.sessionId, normalizeRpcTranscriptEvent(payload));

  if (payload.type === 'response' && payload.command === 'get_state' && payload.success && payload.data) {
    await syncSessionFromRpcState(runningProcess.sessionId, payload.data);
  }

  if (payload.type === 'agent_end') {
    sendRpcCommand(runningProcess, { id: randomUUID(), type: 'get_state' });
  }
}

function extractMessageText(message) {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((item) => {
      if (item?.type === 'text') return item.text ?? '';
      if (item?.type === 'thinking') return item.thinking ?? '';
      if (item?.type === 'toolCall') return `Tool call: ${item.name ?? 'tool'}`;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function normalizeRpcTranscriptEvent(payload) {
  const base = { rpcType: payload.type, payload };

  if (payload.type === 'message_update') {
    const delta = payload.assistantMessageEvent;
    if (delta?.type === 'text_delta') {
      return { ...base, type: 'assistant_delta', content: delta.delta ?? '' };
    }
    if (delta?.type === 'thinking_delta') {
      return { ...base, type: 'assistant_delta', subtype: 'thinking', content: delta.delta ?? '' };
    }
  }

  if (payload.type === 'message_end') {
    const content = extractMessageText(payload.message);
    if (content) return { ...base, type: 'assistant_delta', content };
  }

  if (payload.type === 'turn_end') {
    const content = extractMessageText(payload.message);
    if (content) return { ...base, type: 'assistant_delta', content };
  }

  if (payload.type === 'tool_execution_update') {
    const text = payload.partialResult?.content
      ?.map((item) => (item.type === 'text' ? item.text : ''))
      .join('') ?? '';
    return { ...base, type: 'tool_execution_update', toolName: payload.toolName, content: text };
  }

  if (payload.type === 'extension_ui_request') {
    return {
      ...base,
      type: 'extension_ui_request',
      content: 'Pi requested UI interaction that H3 Code does not support yet.'
    };
  }

  if (payload.type === 'response') {
    return {
      ...base,
      type: 'rpc_response',
      command: payload.command,
      success: Boolean(payload.success),
      content: payload.success ? '' : payload.error ?? 'Pi RPC command failed.'
    };
  }

  return { ...base, type: 'rpc_event', content: payload.type };
}

function sendRpcCommand(runningProcess, command) {
  if (!runningProcess.child.stdin?.writable) {
    throw new Error('Pi RPC stdin is not writable.');
  }

  runningProcess.child.stdin.write(`${JSON.stringify(command)}\n`);
}

async function syncSessionFromRpcState(sessionId, state) {
  await updateSession(sessionId, (session) => {
    const patch = {};

    if (typeof state.sessionFile === 'string' && state.sessionFile && state.sessionFile !== session.harnessSessionPath) {
      patch.harnessSessionPath = state.sessionFile;
    }

    if (
      typeof state.sessionName === 'string' &&
      state.sessionName.trim() &&
      session.titleSource !== 'user' &&
      state.sessionName.trim() !== session.title
    ) {
      patch.title = state.sessionName.trim();
      patch.titleSource = 'pi';
    }

    return patch;
  });
}

async function startPiRpcProcess(session, repo, settings) {
  const args = ['--mode', 'rpc'];
  if (session.harnessSessionPath) args.push('--session', session.harnessSessionPath);

  const child = spawn(settings.piExecutablePath, args, {
    cwd: repo.path,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const runningProcess = {
    child,
    repoId: repo.id,
    sessionId: session.id,
    harness: 'pi',
    isStreaming: false,
    stdoutBuffer: '',
    intentionalStop: false,
    startedAt: new Date().toISOString()
  };

  runningProcesses.set(session.id, runningProcess);
  attachRpcJsonlReader(child, runningProcess);

  child.stderr.on('data', (chunk) => {
    void appendTranscriptEvent(session.id, { type: 'stderr', stream: 'stderr', content: chunk.toString('utf8') });
  });

  child.on('error', (error) => {
    void appendTranscriptEvent(session.id, { type: 'process_exit', exitCode: null, content: error.message });
    void updateSession(session.id, () => ({ status: 'error' }));
    runningProcesses.delete(session.id);
  });

  child.on('exit', (code, signal) => {
    runningProcesses.delete(session.id);
    void appendTranscriptEvent(session.id, {
      type: 'process_exit',
      exitCode: code,
      signal,
      content: runningProcess.intentionalStop ? 'Pi session stopped.' : `Pi exited with code ${code ?? 'unknown'}.`
    });
    void updateSession(session.id, () => ({ status: runningProcess.intentionalStop || code === 0 ? 'idle' : 'error' }));
  });

  await appendTranscriptEvent(session.id, { type: 'process_started', content: 'Pi RPC session started.' });
  await updateSession(session.id, () => ({ status: 'running' }));
  sendRpcCommand(runningProcess, { id: randomUUID(), type: 'get_state' });
  return runningProcess;
}

async function getOrStartPiRpcProcess(session, repo, settings) {
  const existing = runningProcesses.get(session.id);
  if (existing && !existing.child.killed) return existing;
  return startPiRpcProcess(session, repo, settings);
}

function registerIpcHandlers() {
  ipcMain.handle('metadata:get', async () => readMetadata());

  ipcMain.handle('settings:get', async () => getSettingsState());

  ipcMain.handle('settings:update', async (_event, input) => {
    const settings = sanitizeSettings(input);

    await writeSettings(settings);
    return getSettingsState(settings);
  });

  ipcMain.handle('settings:detectPiExecutable', async () => detectPiExecutable());

  ipcMain.handle('dialog:pickRepositoryDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return ok(null);
    }

    return ok({ path: result.filePaths[0] });
  });

  ipcMain.handle('repos:list', async () => {
    const metadata = await readMetadata();
    return ok(sortRepos(metadata.repos));
  });

  ipcMain.handle('repos:add', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const pathError = requireNonEmptyString(input, 'path');
    if (pathError) return fail('invalid_input', pathError);

    const repoPath = path.resolve(input.path.trim());
    const validation = await validateRepoDirectory(repoPath);
    if (!validation.ok) return validation;

    const metadata = await readMetadata();
    const existingRepo = metadata.repos.find((repo) => path.resolve(repo.path) === repoPath);
    const now = new Date().toISOString();

    if (existingRepo) {
      const selectedRepo = { ...existingRepo, lastOpenedAt: now };
      const repos = metadata.repos.map((repo) => (repo.id === existingRepo.id ? selectedRepo : repo));
      await writeMetadata({ ...metadata, selectedRepoId: selectedRepo.id, repos });
      return ok(selectedRepo);
    }

    const repo = {
      id: randomUUID(),
      name: path.basename(repoPath),
      path: repoPath,
      addedAt: now,
      lastOpenedAt: now
    };

    await writeMetadata({ ...metadata, selectedRepoId: repo.id, repos: [...metadata.repos, repo] });
    return ok(repo);
  });

  ipcMain.handle('repos:select', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);

    const metadata = await readMetadata();
    const repo = findRepo(metadata, input.repoId.trim());
    if (!repo) return fail('repo_not_found', 'Repository could not be found.');

    const selectedRepo = { ...repo, lastOpenedAt: new Date().toISOString() };
    const repos = metadata.repos.map((item) => (item.id === selectedRepo.id ? selectedRepo : item));

    await writeMetadata({ ...metadata, selectedRepoId: selectedRepo.id, repos });
    return ok(selectedRepo);
  });

  ipcMain.handle('sessions:list', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);

    const metadata = await readMetadata();
    if (!findRepo(metadata, input.repoId.trim())) return fail('repo_not_found', 'Repository could not be found.');

    return ok(metadata.sessions.filter((session) => session.repoId === input.repoId.trim()));
  });

  ipcMain.handle('sessions:create', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);

    const metadata = await readMetadata();
    const repoId = input.repoId.trim();
    const repo = findRepo(metadata, repoId);
    if (!repo) return fail('repo_not_found', 'Repository could not be found.');

    const now = new Date().toISOString();
    const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'New session';
    const session = {
      id: randomUUID(),
      repoId,
      harness: 'pi',
      harnessSessionPath: '',
      title,
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      titleSource: typeof input.title === 'string' && input.title.trim() ? 'user' : 'local'
    };

    const repos = metadata.repos.map((item) =>
      item.id === repo.id ? { ...item, selectedSessionId: session.id, lastOpenedAt: now } : item
    );

    await writeMetadata({
      ...metadata,
      selectedRepoId: repo.id,
      repos,
      sessions: [...metadata.sessions, session]
    });
    return ok(session);
  });

  ipcMain.handle('sessions:select', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);

    const sessionIdError = requireNonEmptyString(input, 'sessionId');
    if (sessionIdError) return fail('invalid_input', sessionIdError);

    const metadata = await readMetadata();
    const repoId = input.repoId.trim();
    const sessionId = input.sessionId.trim();
    const repo = findRepo(metadata, repoId);
    if (!repo) return fail('repo_not_found', 'Repository could not be found.');

    const session = findSession(metadata, sessionId);
    if (!session) return fail('session_not_found', 'Session could not be found.');
    if (session.repoId !== repoId) return fail('session_repo_mismatch', 'Session does not belong to this repository.');

    const repos = metadata.repos.map((item) =>
      item.id === repo.id ? { ...item, selectedSessionId: session.id, lastOpenedAt: new Date().toISOString() } : item
    );

    await writeMetadata({ ...metadata, selectedRepoId: repo.id, repos });
    return ok(session);
  });

  ipcMain.handle('sessions:getMessages', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const sessionIdError = requireNonEmptyString(input, 'sessionId');
    if (sessionIdError) return fail('invalid_input', sessionIdError);

    const metadata = await readMetadata();
    const sessionId = input.sessionId.trim();
    if (!findSession(metadata, sessionId)) return fail('session_not_found', 'Session could not be found.');

    return ok(await readTranscriptEvents(sessionId));
  });

  ipcMain.handle('sessions:updateTitle', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const sessionIdError = requireNonEmptyString(input, 'sessionId');
    if (sessionIdError) return fail('invalid_input', sessionIdError);

    const titleError = requireNonEmptyString(input, 'title');
    if (titleError) return fail('invalid_input', titleError);

    const updated = await updateSession(input.sessionId.trim(), () => ({ title: input.title.trim(), titleSource: 'user' }));
    if (!updated) return fail('session_not_found', 'Session could not be found.');
    return ok(updated);
  });

  ipcMain.handle('sessions:sendMessage', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const sessionIdError = requireNonEmptyString(input, 'sessionId');
    if (sessionIdError) return fail('invalid_input', sessionIdError);

    const promptError = requireNonEmptyString(input, 'prompt');
    if (promptError) return fail('invalid_input', promptError);

    const sessionId = input.sessionId.trim();
    const prompt = input.prompt.trim();
    const metadata = await readMetadata();
    const session = findSession(metadata, sessionId);
    if (!session) return fail('session_not_found', 'Session could not be found.');

    const repo = findRepo(metadata, session.repoId);
    if (!repo) return fail('repo_not_found', 'Repository could not be found.');

    const settingsState = await getSettingsState(metadata.settings);
    if (settingsState.validation.status !== 'valid') {
      return fail('invalid_pi_path', settingsState.validation.message);
    }

    if (session.titleSource !== 'user' && session.title === 'New session') {
      await updateSession(sessionId, () => ({ title: derivePromptTitle(prompt), titleSource: 'local' }));
    }

    await appendTranscriptEvent(sessionId, { type: 'user_message', role: 'user', content: prompt });

    try {
      const runningProcess = await getOrStartPiRpcProcess(session, repo, metadata.settings);
      const command = { id: randomUUID(), type: 'prompt', message: prompt };
      if (runningProcess.isStreaming) command.streamingBehavior = 'steer';
      sendRpcCommand(runningProcess, command);
      return ok({ accepted: true });
    } catch (error) {
      await appendTranscriptEvent(sessionId, { type: 'process_exit', content: error.message });
      await updateSession(sessionId, () => ({ status: 'error' }));
      return fail('pi_start_failed', error.message);
    }
  });

  ipcMain.handle('files:resolveMentions', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);

    if (typeof input.prompt !== 'string') return fail('invalid_input', 'prompt is required.');

    const metadata = await readMetadata();
    if (!findRepo(metadata, input.repoId.trim())) return fail('repo_not_found', 'Repository could not be found.');

    return ok({ prompt: input.prompt, mentions: [] });
  });

  ipcMain.handle('pi:stopSession', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);

    const sessionIdError = requireNonEmptyString(input, 'sessionId');
    if (sessionIdError) return fail('invalid_input', sessionIdError);

    const sessionId = input.sessionId.trim();
    const metadata = await readMetadata();
    if (!findSession(metadata, sessionId)) return fail('session_not_found', 'Session could not be found.');

    const runningProcess = runningProcesses.get(sessionId);
    if (!runningProcess) return fail('no_running_process', 'There is no running Pi process for this session.');

    runningProcess.intentionalStop = true;
    try {
      sendRpcCommand(runningProcess, { id: randomUUID(), type: 'abort' });
    } catch {
      // Fall through to process termination.
    }

    setTimeout(() => {
      if (!runningProcess.child.killed) runningProcess.child.kill();
    }, 1000);

    await updateSession(sessionId, () => ({ status: 'idle' }));
    return ok({ stopped: true });
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
