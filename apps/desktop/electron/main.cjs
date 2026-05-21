const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { execFile, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { constants } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const rendererUrl = process.env.H3CODE_RENDERER_URL || 'http://127.0.0.1:5173';
const metadataSchemaVersion = 2;
const defaultSettings = { piExecutablePath: '' };
const defaultMetadata = {
  schemaVersion: metadataSchemaVersion,
  selectedRepoId: '',
  repos: [],
  settings: defaultSettings
};

let activeProcess = null;

function getMetadataPath() {
  return path.join(app.getPath('userData'), 'h3-metadata.json');
}

function getLegacySettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getPiSessionsPath() {
  return path.join(app.getPath('home'), '.pi', 'agent', 'sessions');
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

function sanitizeSettings(input) {
  return {
    piExecutablePath:
      typeof input?.piExecutablePath === 'string' ? input.piExecutablePath.trim() : defaultSettings.piExecutablePath
  };
}

function sanitizeRepo(input) {
  if (!input || typeof input !== 'object') return null;
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
    ...(typeof input.selectedSessionPath === 'string' ? { selectedSessionPath: input.selectedSessionPath } : {})
  };
}

function sanitizeMetadata(input) {
  const root = input && typeof input === 'object' ? input : {};
  return {
    schemaVersion: metadataSchemaVersion,
    selectedRepoId: typeof root.selectedRepoId === 'string' ? root.selectedRepoId : '',
    repos: Array.isArray(root.repos) ? root.repos.map(sanitizeRepo).filter(Boolean) : [],
    settings: sanitizeSettings(root.settings)
  };
}

async function readLegacySettings() {
  try {
    return sanitizeSettings(JSON.parse(await fs.readFile(getLegacySettingsPath(), 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return { ...defaultSettings };
    throw error;
  }
}

async function preserveCorruptMetadata() {
  const metadataPath = getMetadataPath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.rename(metadataPath, path.join(path.dirname(metadataPath), `h3-metadata.corrupt-${timestamp}.json`));
}

async function readMetadata() {
  try {
    const parsed = JSON.parse(await fs.readFile(getMetadataPath(), 'utf8'));
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
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(sanitizeMetadata(metadata), null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, metadataPath);
}

async function readSettings() {
  return (await readMetadata()).settings;
}

async function writeSettings(settings) {
  const metadata = await readMetadata();
  await writeMetadata({ ...metadata, settings });
}

async function validatePiExecutablePath(piExecutablePath) {
  const normalizedPath = piExecutablePath.trim();
  if (!normalizedPath) return { status: 'missing', message: 'Set the Pi executable path before sending prompts.' };

  let stats;
  try {
    stats = await fs.stat(normalizedPath);
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'nonexistent', message: 'No file exists at this path.' };
    throw error;
  }

  if (!stats.isFile()) return { status: 'non-file', message: 'The Pi executable path must point to a file.' };

  try {
    await fs.access(normalizedPath, constants.X_OK);
  } catch {
    return { status: 'non-executable', message: 'This file is not executable.' };
  }

  return { status: 'valid', message: 'Pi executable path is ready.' };
}

async function getSettingsState(settings = null) {
  const currentSettings = settings ?? (await readSettings());
  return {
    settings: currentSettings,
    validation: await validatePiExecutablePath(currentSettings.piExecutablePath)
  };
}

async function isValidPiExecutablePath(candidatePath) {
  return (await validatePiExecutablePath(candidatePath)).status === 'valid';
}

async function detectPiOnPath() {
  const command = process.platform === 'win32' ? 'where' : 'sh';
  const args = process.platform === 'win32' ? ['pi'] : ['-lc', 'command -v pi'];

  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 3000 });
    const candidatePath = stdout.split(/\r?\n/).find(Boolean)?.trim();
    if (candidatePath && (await isValidPiExecutablePath(candidatePath))) return { path: candidatePath, source: 'path' };
    return candidatePath ? { invalidCandidateFound: true } : null;
  } catch {
    return null;
  }
}

async function collectNvmPiCandidates(homeDirectory) {
  try {
    const entries = await fs.readdir(path.join(homeDirectory, '.nvm', 'versions', 'node'), { withFileTypes: true });
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const candidatePath = path.join(homeDirectory, '.nvm', 'versions', 'node', entry.name, 'bin', 'pi');
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
      const stats = await fs.stat(candidate.path);
      if (stats.isFile() && (await isValidPiExecutablePath(candidate.path))) return ok(candidate);
      invalidCandidateFound = true;
    } catch {
      // Missing candidates are expected.
    }
  }

  if (invalidCandidateFound) return fail('pi_candidates_invalid', 'Found Pi candidates, but none were executable.');
  return fail('pi_not_found', 'Could not find Pi automatically. Enter the executable path manually.');
}

async function validateRepoDirectory(repoPath) {
  try {
    const stats = await fs.stat(repoPath);
    if (!stats.isDirectory()) return fail('repo_path_not_directory', 'Repository path must point to a directory.');
    return ok(null);
  } catch (error) {
    if (error.code === 'ENOENT') return fail('repo_path_not_found', 'No directory exists at this repository path.');
    throw error;
  }
}

function sortRepos(repos) {
  return [...repos].sort((a, b) => (b.lastOpenedAt ?? b.addedAt).localeCompare(a.lastOpenedAt ?? a.addedAt));
}

function findRepo(metadata, repoId) {
  return metadata.repos.find((repo) => repo.id === repoId) ?? null;
}

function broadcast(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

async function collectJsonlFiles(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectJsonlFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.jsonl') ? [entryPath] : [];
    })
  );
  return nested.flat();
}

async function readFirstJsonlEntry(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(8192);
    let line = '';
    let position = 0;

    while (!line.includes('\n')) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      line += buffer.subarray(0, bytesRead).toString('utf8');
      position += bytesRead;
    }

    const firstLine = line.split(/\r?\n/, 1)[0]?.trim();
    return firstLine ? JSON.parse(firstLine) : null;
  } finally {
    await handle.close();
  }
}

function titleFromSessionFile(filePath, sessionEntry) {
  if (typeof sessionEntry?.name === 'string' && sessionEntry.name.trim()) return sessionEntry.name.trim();
  const basename = path.basename(filePath, '.jsonl');
  const timestamp = basename.split('_', 1)[0];
  const date = new Date(timestamp);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  return basename;
}

async function scanPiSessionsForRepo(repo) {
  const repoPath = path.resolve(repo.path);
  const files = await collectJsonlFiles(getPiSessionsPath());
  const sessions = [];

  for (const filePath of files) {
    try {
      const entry = await readFirstJsonlEntry(filePath);
      if (entry?.type !== 'session' || path.resolve(entry.cwd ?? '') !== repoPath) continue;
      const stats = await fs.stat(filePath);
      const createdAt = typeof entry.timestamp === 'string' ? entry.timestamp : stats.birthtime.toISOString();

      sessions.push({
        id: entry.id || path.basename(filePath, '.jsonl'),
        repoId: repo.id,
        harness: 'pi',
        harnessSessionPath: filePath,
        title: titleFromSessionFile(filePath, entry),
        createdAt,
        updatedAt: stats.mtime.toISOString(),
        status: activeProcess?.sessionPath === filePath ? activeProcess.status : 'idle',
        isDraft: false
      });
    } catch {
      // Ignore unreadable or malformed session files; Pi owns the format.
    }
  }

  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function createDraftSession(repoId) {
  const now = new Date().toISOString();
  return {
    id: `draft:${randomUUID()}`,
    repoId,
    harness: 'pi',
    harnessSessionPath: '',
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    isDraft: true
  };
}

function emitSessionStatus(session, status) {
  broadcast('sessions:updated', { ...session, status });
}

function emitTranscriptEvent(sessionId, event) {
  broadcast('sessions:transcriptEvent', {
    id: randomUUID(),
    sessionId,
    createdAt: new Date().toISOString(),
    ...event
  });
}

function attachJsonlReader(stream, onLine) {
  const decoder = new StringDecoder('utf8');
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);

    while (true) {
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) break;

      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.trim()) onLine(line);
    }
  });

  stream.on('end', () => {
    buffer += decoder.end();
    if (!buffer) return;
    const line = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
    if (line.trim()) onLine(line);
  });
}

function attachRpcJsonlReader(processState) {
  attachJsonlReader(processState.child.stdout, (line) => {
    void handleRpcLine(processState, line);
  });
}

async function handleRpcLine(processState, line) {
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    emitTranscriptEvent(processState.uiSessionId, {
      kind: 'diagnostic',
      blockId: `stdout:${randomUUID()}`,
      mode: 'final',
      stream: 'stdout',
      content: `Invalid Pi RPC JSON: ${line}`
    });
    return;
  }

  if (payload.type === 'response') {
    handleRpcResponse(processState, payload);
    return;
  }

  if (payload.type === 'agent_start') {
    processState.status = 'running';
    emitSessionStatus(processState.session, 'running');
  }
  if (payload.type === 'agent_end') {
    processState.status = 'idle';
    emitSessionStatus(processState.session, 'idle');
    void refreshActiveMessages(processState);
    void requestRpc(processState, { type: 'get_state' }).catch(() => {});
  }

  if (payload.type === 'extension_ui_request') {
    handleExtensionUiRequest(processState, payload);
    return;
  }

  for (const event of normalizeLiveRpcEvent(processState, payload)) emitTranscriptEvent(processState.uiSessionId, event);
}

function handleRpcResponse(processState, payload) {
  const pending = payload.id ? processState.pendingRequests.get(payload.id) : null;
  if (!pending) return;

  processState.pendingRequests.delete(payload.id);
  clearTimeout(pending.timeout);
  if (payload.success) pending.resolve(payload.data);
  else pending.reject(new Error(payload.error || `${payload.command || pending.command} failed.`));
}

function handleExtensionUiRequest(processState, payload) {
  emitTranscriptEvent(processState.uiSessionId, {
    kind: 'diagnostic',
    blockId: `extension-ui:${payload.id ?? randomUUID()}`,
    mode: 'final',
    title: 'Pi UI request cancelled',
    content: `Pi requested ${payload.method ?? 'UI'} interaction, which H3 Code does not support yet.`,
    rawPayload: payload
  });

  if (payload.id) {
    sendRpcCommand(processState, { type: 'extension_ui_response', id: payload.id, cancelled: true }, { track: false });
  }
}

function sendRpcCommand(processState, command, options = {}) {
  if (!processState.child.stdin?.writable) throw new Error('Pi RPC stdin is not writable.');
  const fullCommand = command.id ? command : { ...command, id: randomUUID() };
  if (options.track !== false) {
    const timeout = setTimeout(() => {
      const pending = processState.pendingRequests.get(fullCommand.id);
      if (!pending) return;
      processState.pendingRequests.delete(fullCommand.id);
      pending.reject(new Error(`${fullCommand.type} timed out.`));
    }, options.timeoutMs ?? 30000);

    processState.pendingRequests.set(fullCommand.id, {
      command: fullCommand.type,
      resolve: options.resolve,
      reject: options.reject,
      timeout
    });
  }
  processState.child.stdin.write(`${JSON.stringify(fullCommand)}\n`);
  return fullCommand.id;
}

function requestRpc(processState, command) {
  return new Promise((resolve, reject) => {
    sendRpcCommand(processState, command, { resolve, reject });
  });
}

function createRpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function formatProcessExit(code, signal) {
  if (signal) return `Pi exited from ${signal}.`;
  return `Pi exited with code ${code ?? 'unknown'}.`;
}

async function stopActiveProcess({ abort = true } = {}) {
  if (!activeProcess) return false;

  const processState = activeProcess;
  processState.intentionalStop = true;

  if (abort && processState.child.stdin?.writable) {
    try {
      sendRpcCommand(processState, { type: 'abort' }, { track: false });
    } catch {
      // The process may already be exiting.
    }
  }

  processState.child.kill('SIGTERM');
  activeProcess = null;
  return true;
}

function rejectPendingRequests(processState, error) {
  for (const pending of processState.pendingRequests.values()) {
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
  processState.pendingRequests.clear();
}

async function startActiveProcess(session, repo, settings) {
  if (activeProcess && activeProcess.repoId === repo.id && activeProcess.sessionPath === session.harnessSessionPath) {
    return activeProcess;
  }

  await stopActiveProcess({ abort: true });

  const child = spawn(settings.piExecutablePath, ['--mode', 'rpc'], {
    cwd: repo.path,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const processState = {
    child,
    repoId: repo.id,
    sessionPath: session.harnessSessionPath,
    uiSessionId: session.id,
    session,
    status: 'idle',
    stdoutBuffer: '',
    pendingRequests: new Map(),
    assistantBlocksWithDeltas: new Set(),
    activeAssistantBlockId: '',
    intentionalStop: false
  };

  activeProcess = processState;
  attachRpcJsonlReader(processState);

  child.stderr.on('data', (chunk) => {
    emitTranscriptEvent(processState.uiSessionId, {
      kind: 'diagnostic',
      blockId: `stderr:${randomUUID()}`,
      mode: 'final',
      stream: 'stderr',
      content: chunk.toString('utf8')
    });
  });

  child.on('error', (error) => {
    processState.status = 'error';
    rejectPendingRequests(processState, error);
    emitTranscriptEvent(processState.uiSessionId, {
      kind: 'error',
      blockId: `process:${randomUUID()}`,
      mode: 'final',
      content: error.message
    });
    emitSessionStatus(processState.session, 'error');
    if (activeProcess === processState) activeProcess = null;
  });

  child.on('exit', (code, signal) => {
    const status = processState.intentionalStop || code === 0 ? 'idle' : 'error';
    const exitMessage = formatProcessExit(code, signal);
    processState.status = status;
    rejectPendingRequests(
      processState,
      createRpcError(processState.intentionalStop ? 'pi_process_stopped' : 'pi_process_exited', exitMessage)
    );
    emitTranscriptEvent(processState.uiSessionId, {
      kind: status === 'error' ? 'error' : 'system',
      blockId: `process:${randomUUID()}`,
      mode: 'final',
      content: processState.intentionalStop ? 'Pi stopped.' : exitMessage,
      rawPayload: { exitCode: code, signal }
    });
    emitSessionStatus(processState.session, status);
    if (activeProcess === processState) activeProcess = null;
  });

  emitSessionStatus(session, 'idle');

  if (session.harnessSessionPath) {
    await requestRpc(processState, { type: 'switch_session', sessionPath: session.harnessSessionPath });
  }

  return processState;
}

async function getRepoAndSession(input) {
  const metadata = await readMetadata();
  const repo = findRepo(metadata, input.repoId?.trim());
  if (!repo) return { error: fail('repo_not_found', 'Repository could not be found.') };

  if (input.sessionId?.startsWith('draft:')) {
    return { metadata, repo, session: { ...createDraftSession(repo.id), id: input.sessionId } };
  }

  const sessions = await scanPiSessionsForRepo(repo);
  const session = sessions.find((item) => item.id === input.sessionId || item.harnessSessionPath === input.sessionPath);
  if (!session) return { error: fail('session_not_found', 'Session could not be found.') };
  return { metadata, repo, session };
}

async function getRepoAndSessionForMessages(input) {
  const metadata = await readMetadata();
  const repo = findRepo(metadata, input.repoId?.trim());
  if (!repo) return { error: fail('repo_not_found', 'Repository could not be found.') };

  if (input.sessionId?.startsWith('draft:')) {
    return { metadata, repo, session: { ...createDraftSession(repo.id), id: input.sessionId } };
  }

  if (typeof input.sessionPath === 'string' && input.sessionPath.trim()) {
    return {
      metadata,
      repo,
      session: {
        id: input.sessionId,
        repoId: repo.id,
        harness: 'pi',
        harnessSessionPath: input.sessionPath.trim(),
        title: path.basename(input.sessionPath.trim(), '.jsonl'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: activeProcess?.sessionPath === input.sessionPath.trim() ? activeProcess.status : 'idle',
        isDraft: false
      }
    };
  }

  return getRepoAndSession(input);
}

async function ensureProcessForSession(input) {
  const result = await getRepoAndSession(input);
  if (result.error) return result;

  const settingsState = await getSettingsState();
  if (settingsState.validation.status !== 'valid') {
    return { error: fail('invalid_pi_path', settingsState.validation.message) };
  }

  const processState = await startActiveProcess(result.session, result.repo, settingsState.settings);
  return { ...result, processState };
}

async function refreshActiveMessages(processState) {
  try {
    const data = await requestRpc(processState, { type: 'get_messages' });
    broadcast('sessions:messagesUpdated', createMessagesResult(data, processState.session));
  } catch {
    // Live events still remain visible if Pi cannot provide a snapshot.
  }
}

function createMessagesResult(data, session, { source = 'rpc', timings } = {}) {
  const normalizeStartedAt = Date.now();
  const rawMessages = getRawMessages(data);
  const messages = rawMessages.flatMap((message, index) => normalizeMessage(message, index));

  if (rawMessages.length > 0 && messages.length === 0) {
    messages.push({
      id: 'diagnostic:no-visible-messages',
      kind: 'diagnostic',
      title: 'Pi messages hidden',
      content: `Pi returned ${rawMessages.length} messages, but none had visible text content.`,
      createdAt: new Date().toISOString()
    });
  }

  return {
    messages,
    meta: {
      sessionId: session.id,
      sessionPath: session.harnessSessionPath,
      rawMessageCount: rawMessages.length,
      normalizedMessageCount: messages.length,
      source,
      ...(!app.isPackaged
        ? {
            timings: {
              ...(timings ?? {}),
              normalizeMs: Date.now() - normalizeStartedAt
            }
          }
        : {})
    }
  };
}

function createDiagnosticMessagesResult(session, title, content) {
  return {
    messages: [{
      id: `diagnostic:${Date.now()}`,
      kind: 'diagnostic',
      title,
      content,
      createdAt: new Date().toISOString()
    }],
    meta: {
      sessionId: session.id,
      sessionPath: session.harnessSessionPath,
      rawMessageCount: 0,
      normalizedMessageCount: 1,
      source: 'diagnostic'
    }
  };
}

async function loadLocalSessionMessages(session) {
  if (!session.harnessSessionPath) {
    throw createRpcError('missing_session_path', 'Pi session file path is required.');
  }

  const contents = await fs.readFile(session.harnessSessionPath, 'utf8');
  const messages = [];
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      messages.push(JSON.parse(line));
    } catch {
      // Ignore malformed JSONL entries; Pi owns the session file.
    }
  }
  return createMessagesResult(messages, session, { source: 'jsonl' });
}

function loadSessionMessagesOnce(session, repo, settings) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timings = {};
    const child = spawn(settings.piExecutablePath, ['--mode', 'rpc'], {
      cwd: repo.path,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const pendingRequests = new Map();
    let settled = false;
    let stderr = '';

    function cleanup() {
      for (const pending of pendingRequests.values()) clearTimeout(pending.timeout);
      pendingRequests.clear();
      child.removeAllListeners();
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
    }

    function finish(error, result) {
      if (settled) return;
      settled = true;
      cleanup();

      if (!child.killed) child.kill('SIGTERM');
      if (error) reject(error);
      else resolve(result);
    }

    function send(command, timeoutMs = 10000) {
      if (!child.stdin?.writable) throw createRpcError('pi_rpc_stdin_closed', 'Pi RPC stdin is not writable.');

      const fullCommand = { ...command, id: command.id ?? randomUUID() };
      const commandStartedAt = Date.now();
      const timeout = setTimeout(() => {
        pendingRequests.delete(fullCommand.id);
        finish(createRpcError('pi_rpc_timeout', `${fullCommand.type} timed out while loading messages.`));
      }, timeoutMs);

      pendingRequests.set(fullCommand.id, {
        command: fullCommand.type,
        startedAt: commandStartedAt,
        timeout
      });

      child.stdin.write(`${JSON.stringify(fullCommand)}\n`);
    }

    attachJsonlReader(child.stdout, (line) => {
      let payload;
      try {
        payload = JSON.parse(line);
      } catch {
        return;
      }

      if (payload.type !== 'response' || !payload.id) return;
      const pending = pendingRequests.get(payload.id);
      if (!pending) return;

      pendingRequests.delete(payload.id);
      clearTimeout(pending.timeout);

      if (!payload.success) {
        finish(createRpcError('pi_rpc_failed', payload.error || `${pending.command} failed while loading messages.`));
        return;
      }

      if (pending.command === 'switch_session') {
        timings.switchSessionMs = Date.now() - pending.startedAt;
        send({ type: 'get_messages' }, 15000);
        return;
      }

      if (pending.command === 'get_messages') {
        timings.getMessagesMs = Date.now() - pending.startedAt;
        timings.totalMs = Date.now() - startedAt;
        finish(null, createMessagesResult(payload.data, session, { source: 'rpc', timings }));
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      finish(error);
    });

    child.on('exit', (code, signal) => {
      if (settled) return;
      const message = [formatProcessExit(code, signal), stderr.trim()].filter(Boolean).join('\n');
      finish(createRpcError('pi_process_exited', message));
    });

    send({ type: 'switch_session', sessionPath: session.harnessSessionPath }, 15000);
  });
}

function getRawMessages(data) {
  return Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
}

function normalizeMessages(data) {
  return createMessagesResult(data, { id: '', harnessSessionPath: '' }).messages;
}

function normalizeMessage(message, index) {
  const id = message?.id ?? message?.entryId ?? `${index}`;
  const createdAt = normalizeTimestamp(message?.timestamp);
  const role = message?.role ?? message?.message?.role ?? message?.type;
  const content = extractMessageText(message?.message ?? message) || extractCustomMessageText(message);

  if (role === 'user' || role === 'assistant') {
    return [{
      id,
      kind: role,
      title: role === 'assistant' ? 'Pi' : 'You',
      content,
      createdAt
    }];
  }

  if (message?.type === 'tool_execution_start' || message?.type === 'tool_execution_update' || message?.type === 'tool_execution_end') {
    return [{
      id,
      kind: message.isError ? 'error' : 'tool',
      title: message.toolName ? `Tool: ${message.toolName}` : 'Tool',
      content: getToolText(message.result ?? message.partialResult) || message.toolName || '',
      createdAt
    }];
  }

  if (!content || message?.display === false) return [];
  return [{ id, kind: 'diagnostic', title: message?.customType ?? message?.type ?? role ?? 'Pi', content, createdAt }];
}

function normalizeTimestamp(timestamp) {
  if (typeof timestamp === 'number') return new Date(timestamp).toISOString();
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  return new Date().toISOString();
}

function getRpcMessageId(message) {
  return message?.id ?? message?.entryId ?? message?.timestamp ?? 'active';
}

function getAssistantBlockId(processState, payload, contentIndex = 0) {
  const blockId = `assistant:${getRpcMessageId(payload.message)}:${contentIndex}`;
  processState.assistantBlocksWithDeltas.add(blockId);
  processState.activeAssistantBlockId = blockId;
  return blockId;
}

function extractMessageText(message) {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item?.type === 'text') return item.text ?? '';
      if (item?.type === 'thinking') return item.thinking ?? '';
      if (item?.type === 'toolCall') return `Tool call: ${item.name ?? 'tool'}`;
      if (typeof item?.text === 'string') return item.text;
      if (typeof item?.content === 'string') return item.content;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function extractCustomMessageText(message) {
  if (typeof message?.content === 'string') return message.content;
  if (typeof message?.text === 'string') return message.text;
  if (typeof message?.message === 'string') return message.message;
  return '';
}

function getToolText(result) {
  return result?.content?.map((item) => (item.type === 'text' ? item.text : '')).join('') ?? '';
}

function normalizeLiveRpcEvent(processState, payload) {
  if (payload.type === 'agent_start') {
    return [{ kind: 'system', blockId: 'agent:status', mode: 'replace', content: 'Pi started processing.', rawPayload: payload }];
  }
  if (payload.type === 'agent_end') {
    return [{ kind: 'system', blockId: 'agent:status', mode: 'final', content: 'Pi finished processing.', rawPayload: payload }];
  }
  if (payload.type === 'message_update') {
    const delta = payload.assistantMessageEvent;
    if (delta?.type === 'text_delta' || delta?.type === 'thinking_delta') {
      return [{
        kind: 'assistant',
        blockId: getAssistantBlockId(processState, payload, delta.contentIndex ?? 0),
        mode: 'append',
        title: delta.type === 'thinking_delta' ? 'Thinking' : 'Pi',
        content: delta.delta ?? '',
        rawPayload: payload
      }];
    }
    if (delta?.type === 'toolcall_start' || delta?.type === 'toolcall_end') {
      const toolCall = delta.toolCall ?? delta.partial?.content?.find((item) => item?.type === 'toolCall');
      return [{
        kind: 'tool',
        blockId: getAssistantBlockId(processState, payload, delta.contentIndex ?? 0),
        mode: 'replace',
        title: 'Tool call',
        content: `Tool call: ${toolCall?.name ?? 'tool'}`,
        rawPayload: payload
      }];
    }
    if (delta?.type === 'toolcall_delta' && delta.delta) {
      return [{
        kind: 'tool',
        blockId: getAssistantBlockId(processState, payload, delta.contentIndex ?? 0),
        mode: 'append',
        title: 'Tool call',
        content: delta.delta,
        rawPayload: payload
      }];
    }
    if (delta?.type === 'error') {
      return [{
        kind: 'error',
        blockId: `assistant-error:${getRpcMessageId(payload.message)}`,
        mode: 'final',
        content: delta.reason ?? 'Pi assistant message failed.',
        rawPayload: payload
      }];
    }
  }
  if (payload.type === 'tool_execution_start' || payload.type === 'tool_execution_update' || payload.type === 'tool_execution_end') {
    return [{
      kind: payload.isError ? 'error' : 'tool',
      blockId: `tool:${payload.toolCallId ?? randomUUID()}`,
      mode: payload.type === 'tool_execution_end' ? 'final' : 'replace',
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      title: payload.toolName ? `Tool: ${payload.toolName}` : 'Tool',
      content: getToolText(payload.result ?? payload.partialResult) || (payload.toolName ? `Running ${payload.toolName}...` : 'Running tool...'),
      rawPayload: payload
    }];
  }
  return [];
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
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return ok(result.canceled || result.filePaths.length === 0 ? null : { path: result.filePaths[0] });
  });

  ipcMain.handle('repos:list', async () => ok(sortRepos((await readMetadata()).repos)));

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
      await writeMetadata({
        ...metadata,
        selectedRepoId: selectedRepo.id,
        repos: metadata.repos.map((repo) => (repo.id === selectedRepo.id ? selectedRepo : repo))
      });
      return ok(selectedRepo);
    }

    const repo = { id: randomUUID(), name: path.basename(repoPath), path: repoPath, addedAt: now, lastOpenedAt: now };
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
    await writeMetadata({
      ...metadata,
      selectedRepoId: selectedRepo.id,
      repos: metadata.repos.map((item) => (item.id === selectedRepo.id ? selectedRepo : item))
    });
    return ok(selectedRepo);
  });

  ipcMain.handle('sessions:list', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);
    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);

    const metadata = await readMetadata();
    const repo = findRepo(metadata, input.repoId.trim());
    if (!repo) return fail('repo_not_found', 'Repository could not be found.');

    return ok(await scanPiSessionsForRepo(repo));
  });

  ipcMain.handle('sessions:createDraft', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);
    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);

    const metadata = await readMetadata();
    if (!findRepo(metadata, input.repoId.trim())) return fail('repo_not_found', 'Repository could not be found.');
    return ok(createDraftSession(input.repoId.trim()));
  });

  ipcMain.handle('sessions:select', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);
    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);
    const sessionIdError = requireNonEmptyString(input, 'sessionId');
    if (sessionIdError) return fail('invalid_input', sessionIdError);

    const result = await getRepoAndSession(input);
    if (result.error) return result.error;

    await writeMetadata({
      ...result.metadata,
      selectedRepoId: result.repo.id,
      repos: result.metadata.repos.map((repo) =>
        repo.id === result.repo.id ? { ...repo, selectedSessionPath: result.session.harnessSessionPath } : repo
      )
    });

    return ok(result.session);
  });

  ipcMain.handle('sessions:getLocalMessages', async (_event, input) => {
    try {
      const objectError = requireObject(input);
      if (objectError) return fail('invalid_input', objectError);
      const sessionPathError = requireNonEmptyString(input, 'sessionPath');
      if (sessionPathError) return fail('invalid_input', sessionPathError);
      if (input.sessionId?.startsWith('draft:')) {
        return ok(createMessagesResult({ messages: [] }, { id: input.sessionId, harnessSessionPath: '' }, { source: 'jsonl' }));
      }

      const result = await getRepoAndSessionForMessages(input);
      if (result.error) return result.error;
      return ok(await loadLocalSessionMessages(result.session));
    } catch (error) {
      return fail(error.code || 'pi_local_messages_failed', error.message);
    }
  });

  ipcMain.handle('sessions:getMessages', async (_event, input) => {
    try {
      const objectError = requireObject(input);
      if (objectError) return fail('invalid_input', objectError);
      if (input.sessionId?.startsWith('draft:')) {
        return ok(createMessagesResult({ messages: [] }, { id: input.sessionId, harnessSessionPath: '' }, { source: 'rpc' }));
      }

      const result = await getRepoAndSessionForMessages(input);
      if (result.error) return result.error;

      const settingsState = await getSettingsState();
      if (settingsState.validation.status !== 'valid') {
        return fail('invalid_pi_path', settingsState.validation.message);
      }

      return ok(await loadSessionMessagesOnce(result.session, result.repo, settingsState.settings));
    } catch (error) {
      const objectError = requireObject(input);
      if (objectError || input.sessionId?.startsWith('draft:')) return fail(error.code || 'pi_get_messages_failed', error.message);

      const fallback = await getRepoAndSessionForMessages(input).catch(() => null);
      if (fallback?.session) {
        return ok(createDiagnosticMessagesResult(fallback.session, 'Pi message load failed', error.message));
      }

      return fail(error.code || 'pi_get_messages_failed', error.message);
    }
  });

  ipcMain.handle('sessions:sendMessage', async (_event, input) => {
    const objectError = requireObject(input);
    if (objectError) return fail('invalid_input', objectError);
    const repoIdError = requireNonEmptyString(input, 'repoId');
    if (repoIdError) return fail('invalid_input', repoIdError);
    const sessionIdError = requireNonEmptyString(input, 'sessionId');
    if (sessionIdError) return fail('invalid_input', sessionIdError);
    const promptError = requireNonEmptyString(input, 'prompt');
    if (promptError) return fail('invalid_input', promptError);

    const ready = await ensureProcessForSession(input);
    if (ready.error) return ready.error;

    emitTranscriptEvent(ready.session.id, {
      kind: 'user',
      blockId: `user:${randomUUID()}`,
      mode: 'final',
      content: input.prompt.trim()
    });

    try {
      await requestRpc(ready.processState, { type: 'prompt', message: input.prompt.trim() });
      const state = await requestRpc(ready.processState, { type: 'get_state' }).catch(() => null);
      const sessionPath = typeof state?.sessionFile === 'string' ? state.sessionFile : ready.session.harnessSessionPath;
      return ok({ accepted: true, sessionPath });
    } catch (error) {
      return fail('pi_prompt_failed', error.message);
    }
  });

  ipcMain.handle('pi:stop', async () => ok({ stopped: await stopActiveProcess({ abort: true }) }));
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
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  void stopActiveProcess({ abort: true });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
