import { DatabaseSync } from "node:sqlite";

import { closeDatabase, getDatabase, getDatabasePath } from "./database.js";
import {
  getIndexedSessionsForRepo as getIndexedSessionsForRepoRows,
  getIndexedSessions,
  type IndexedSessionPreference,
} from "./preferences-indexed-sessions.js";
import { ensureRepoStub } from "./preferences-repo.js";
import {
  getRecentRepos as getRecentReposRows,
  type RecentRepoPreference,
} from "./preferences-schema.js";
import {
  getRegisteredSession as getRegisteredSessionRow,
  isRegisteredSession as isRegisteredSessionRow,
  registerH3CodeSession as registerH3CodeSessionRow,
  removeRegisteredSession as removeRegisteredSessionRow,
  touchRegisteredSession as touchRegisteredSessionRow,
  updateRegisteredSessionMetadata as updateRegisteredSessionMetadataRow,
  type RegisterH3CodeSessionInput,
  type RegisteredSessionMetadataPatch,
} from "./session-registry.js";

export type DesktopSettings = {
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  preferDiffPanel: boolean;
  autoConnectOnLaunch: boolean;
};

export type { IndexedSessionPreference, RecentRepoPreference, RegisterH3CodeSessionInput, RegisteredSessionMetadataPatch };

export type SessionWorktreePreference = {
  sessionId: string;
  repoPath: string;
  repoName: string;
  worktreePath: string;
  sessionName?: string;
};

export type DesktopPreferences = {
  recentRepos: RecentRepoPreference[];
  indexedSessions: IndexedSessionPreference[];
  lastSelectedRepoPath?: string;
  lastSelectedSessionPath?: string;
  desktopSettings: DesktopSettings;
  databasePath: string;
  piExecutablePath: string;
};

const recentRepoLimit = 10;
const defaultPiExecutablePath = "pi";
const defaultDesktopSettings: DesktopSettings = {
  sidebarOpen: true,
  contextPanelOpen: false,
  preferDiffPanel: false,
  autoConnectOnLaunch: false,
};

export function getPreferences(): DesktopPreferences {
  const db = getDatabase();
  const lastSelectedRepoPath = getSetting(db, "lastSelectedRepoPath");
  const lastSelectedSessionPath = getSetting(db, "lastSelectedSessionPath");

  return {
    recentRepos: getRecentRepos(db),
    indexedSessions: getIndexedSessions(db),
    lastSelectedRepoPath,
    lastSelectedSessionPath,
    desktopSettings: getDesktopSettings(db),
    databasePath: getDatabasePath(),
    piExecutablePath: getPiExecutablePath(db),
  };
}

export function getPiExecutablePath(db = getDatabase()) {
  return getSetting(db, "piExecutablePath") ?? defaultPiExecutablePath;
}

export function setPiExecutablePath(executablePath: string) {
  const trimmed = executablePath.trim();

  if (!trimmed) {
    throw new Error("PI executable path cannot be empty.");
  }

  const db = getDatabase();
  setSetting(db, "piExecutablePath", trimmed);
  return trimmed;
}

export function recordRepoUsage(repoPath: string, lastSessionId?: string) {
  const db = getDatabase();
  const name = basename(repoPath);
  const lastOpenedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO recent_repos (path, name, added_at, last_opened_at, last_session_path)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      last_opened_at = excluded.last_opened_at,
      last_session_path = COALESCE(excluded.last_session_path, recent_repos.last_session_path)
  `).run(repoPath, name, lastOpenedAt, lastOpenedAt, lastSessionId ?? null);

  setSetting(db, "lastSelectedRepoPath", repoPath);

  if (lastSessionId) {
    setSetting(db, "lastSelectedSessionPath", lastSessionId);
    touchRegisteredSession(lastSessionId);
  }

  trimRecentRepos(db);
}

export function registerH3CodeSession(input: RegisterH3CodeSessionInput) {
  registerH3CodeSessionRow(getDatabase(), input);
}

export function isRegisteredSession(h3codeSessionId: string) {
  return isRegisteredSessionRow(getDatabase(), h3codeSessionId);
}

export function getRegisteredSession(h3codeSessionId: string) {
  return getRegisteredSessionRow(getDatabase(), h3codeSessionId);
}

export function touchRegisteredSession(h3codeSessionId: string) {
  touchRegisteredSessionRow(getDatabase(), h3codeSessionId);
}

export function updateRegisteredSessionMetadata(h3codeSessionId: string, patch: RegisteredSessionMetadataPatch) {
  updateRegisteredSessionMetadataRow(getDatabase(), h3codeSessionId, patch);
}

export function removeRegisteredSession(h3codeSessionId: string) {
  const db = getDatabase();
  const lastSelectedSessionPath = getSetting(db, "lastSelectedSessionPath");
  removeRegisteredSessionRow(db, h3codeSessionId);

  if (lastSelectedSessionPath === h3codeSessionId) {
    deleteSetting(db, "lastSelectedSessionPath");
  }
}

export function listRegisteredSessionsForRepo(repoPath: string) {
  return getIndexedSessionsForRepoRows(getDatabase(), repoPath);
}

export function recordSessionWorktree(repoPath: string, h3codeSessionId: string, worktreePath: string) {
  const db = getDatabase();
  const createdAt = new Date().toISOString();

  ensureRepoStub(db, repoPath);
  db.prepare(`
    INSERT INTO session_worktrees (h3code_session_id, repo_path, worktree_path, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(h3code_session_id) DO UPDATE SET
      repo_path = excluded.repo_path,
      worktree_path = excluded.worktree_path
  `).run(h3codeSessionId, repoPath, worktreePath, createdAt);
}

export function getSessionWorktree(h3codeSessionId: string) {
  const row = getDatabase().prepare(`
    SELECT
      h3code_session_id AS sessionId,
      repo_path AS repoPath,
      worktree_path AS worktreePath
    FROM session_worktrees
    WHERE h3code_session_id = ?
  `).get(h3codeSessionId);

  if (!row) {
    return undefined;
  }

  return {
    sessionId: String(row.sessionId),
    repoPath: String(row.repoPath),
    worktreePath: String(row.worktreePath),
  };
}

export function getIndexedSessionsForRepo(repoPath: string) {
  return getIndexedSessionsForRepoRows(getDatabase(), repoPath);
}

export function getRepoWorktrees(repoPath: string) {
  return getDatabase().prepare(`
    SELECT
      h3code_session_id AS sessionId,
      repo_path AS repoPath,
      worktree_path AS worktreePath
    FROM session_worktrees
    WHERE repo_path = ?
    ORDER BY created_at DESC
  `).all(repoPath).map((row) => ({
    sessionId: String(row.sessionId),
    repoPath: String(row.repoPath),
    worktreePath: String(row.worktreePath),
  }));
}

export function getAllSessionWorktrees(): SessionWorktreePreference[] {
  return getDatabase().prepare(`
    SELECT
      worktrees.h3code_session_id AS sessionId,
      worktrees.repo_path AS repoPath,
      repos.name AS repoName,
      worktrees.worktree_path AS worktreePath,
      sessions.name AS sessionName
    FROM session_worktrees AS worktrees
    LEFT JOIN recent_repos AS repos
      ON repos.path = worktrees.repo_path
    LEFT JOIN repo_sessions AS sessions
      ON sessions.h3code_session_id = worktrees.h3code_session_id
    ORDER BY repos.name ASC, worktrees.created_at DESC
  `).all().map((row) => ({
    sessionId: String(row.sessionId),
    repoPath: String(row.repoPath),
    repoName: toOptionalString(row.repoName) ?? basename(String(row.repoPath)),
    worktreePath: String(row.worktreePath),
    sessionName: toOptionalString(row.sessionName),
  }));
}

export function removeSessionWorktreeMapping(h3codeSessionId: string) {
  getDatabase().prepare("DELETE FROM session_worktrees WHERE h3code_session_id = ?").run(h3codeSessionId);
}

export function removeIndexedRepo(repoPath: string) {
  const db = getDatabase();
  const lastSelectedRepoPath = getSetting(db, "lastSelectedRepoPath");
  const lastSelectedSessionPath = getSetting(db, "lastSelectedSessionPath");
  const repoSessionIds = new Set(
    db.prepare("SELECT h3code_session_id AS id FROM repo_sessions WHERE repo_path = ?")
      .all(repoPath)
      .map((row) => String(row.id)),
  );

  db.exec("BEGIN");

  try {
    db.prepare("DELETE FROM recent_repos WHERE path = ?").run(repoPath);

    if (lastSelectedRepoPath === repoPath) {
      deleteSetting(db, "lastSelectedRepoPath");
    }

    if (lastSelectedSessionPath && repoSessionIds.has(lastSelectedSessionPath)) {
      deleteSetting(db, "lastSelectedSessionPath");
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getPreferences();
}

export function clearAllIndexedData() {
  const db = getDatabase();

  db.exec("BEGIN");

  try {
    db.exec("DELETE FROM repo_sessions");
    db.exec("DELETE FROM recent_repos");
    deleteSetting(db, "lastSelectedRepoPath");
    deleteSetting(db, "lastSelectedSessionPath");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getPreferences();
}

export function removeIndexedSession(h3codeSessionId: string, options: { removeWorktreeMapping?: boolean } = {}) {
  const removeWorktreeMapping = options.removeWorktreeMapping ?? true;

  if (removeWorktreeMapping) {
    removeSessionWorktreeMapping(h3codeSessionId);
  }

  removeRegisteredSession(h3codeSessionId);
}

export function updateDesktopSettings(settings: Partial<DesktopSettings>) {
  const db = getDatabase();
  const current = getDesktopSettings(db);
  const next: DesktopSettings = {
    sidebarOpen: typeof settings.sidebarOpen === "boolean" ? settings.sidebarOpen : current.sidebarOpen,
    contextPanelOpen: typeof settings.contextPanelOpen === "boolean" ? settings.contextPanelOpen : current.contextPanelOpen,
    preferDiffPanel: typeof settings.preferDiffPanel === "boolean" ? settings.preferDiffPanel : current.preferDiffPanel,
    autoConnectOnLaunch:
      typeof settings.autoConnectOnLaunch === "boolean" ? settings.autoConnectOnLaunch : current.autoConnectOnLaunch,
  };

  setSetting(db, "sidebarOpen", String(next.sidebarOpen));
  setSetting(db, "contextPanelOpen", String(next.contextPanelOpen));
  setSetting(db, "preferDiffPanel", String(next.preferDiffPanel));
  setSetting(db, "autoConnectOnLaunch", String(next.autoConnectOnLaunch));

  return next;
}

export function revealPreferencesDatabase() {
  return getDatabasePath();
}

export function closePreferencesDatabase() {
  closeDatabase();
}

function getRecentRepos(db: DatabaseSync): RecentRepoPreference[] {
  return getRecentReposRows(db, recentRepoLimit);
}

function getDesktopSettings(db: DatabaseSync): DesktopSettings {
  return {
    sidebarOpen: getBooleanSetting(db, "sidebarOpen", defaultDesktopSettings.sidebarOpen),
    contextPanelOpen: getBooleanSetting(db, "contextPanelOpen", defaultDesktopSettings.contextPanelOpen),
    preferDiffPanel: getBooleanSetting(db, "preferDiffPanel", defaultDesktopSettings.preferDiffPanel),
    autoConnectOnLaunch: getBooleanSetting(db, "autoConnectOnLaunch", defaultDesktopSettings.autoConnectOnLaunch),
  };
}

function getBooleanSetting(db: DatabaseSync, key: string, fallback: boolean) {
  const value = getSetting(db, key);

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function getSetting(db: DatabaseSync, key: string) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return toOptionalString(row?.value);
}

function setSetting(db: DatabaseSync, key: string, value: string) {
  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

function deleteSetting(db: DatabaseSync, key: string) {
  db.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
}

function trimRecentRepos(db: DatabaseSync) {
  db.prepare(`
    DELETE FROM recent_repos
    WHERE path NOT IN (
      SELECT path FROM recent_repos
      ORDER BY added_at DESC
      LIMIT ?
    )
  `).run(recentRepoLimit);
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function basename(value: string) {
  const clean = value.replace(/\/+$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1) || clean;
}
