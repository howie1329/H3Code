import { DatabaseSync } from "node:sqlite";

import { closeDatabase, getDatabase, getDatabasePath } from "./database.js";
import {
  getIndexedSessionsForRepo as getIndexedSessionsForRepoRows,
  getIndexedSessions,
  type IndexedSessionPreference,
} from "./preferences-indexed-sessions.js";
import {
  clearSessionMessageCaches as clearSessionMessageCachesRows,
  deleteSessionMessageCache as deleteSessionMessageCacheRow,
  getSessionMessageCache as getSessionMessageCacheRow,
  upsertSessionMessageCache as upsertSessionMessageCacheRow,
  touchSessionMessageCache as touchSessionMessageCacheRow,
  type SessionMessageCacheEntry,
  type SessionMessageCacheUpsert,
} from "./session-message-cache.js";
import {
  getRecentRepos as getRecentReposRows,
  type RecentRepoPreference,
} from "./preferences-schema.js";

export type { SessionMessageCacheEntry, SessionMessageCacheState, SessionMessageCacheUpsert } from "./session-message-cache.js";

export type DesktopSettings = {
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  preferDiffPanel: boolean;
  autoConnectOnLaunch: boolean;
};

export type { IndexedSessionPreference, RecentRepoPreference };

export type SessionWorktreePreference = {
  sessionPath: string;
  repoPath: string;
  repoName: string;
  worktreePath: string;
  sessionId?: string;
  sessionName?: string;
};

export type RepoSessionRowInput = {
  path: string;
  id: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
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

export function recordRepoUsage(repoPath: string, lastSessionPath?: string) {
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
  `).run(repoPath, name, lastOpenedAt, lastOpenedAt, lastSessionPath ?? null);

  setSetting(db, "lastSelectedRepoPath", repoPath);

  if (lastSessionPath) {
    setSetting(db, "lastSelectedSessionPath", lastSessionPath);
    recordSessionOpened(db, lastSessionPath, lastOpenedAt);
  }

  trimRecentRepos(db);
}

function ensureRepoStub(db: DatabaseSync, repoPath: string) {
  const name = basename(repoPath);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO recent_repos (path, name, added_at, last_opened_at, last_session_path, sessions_indexed_at)
    VALUES (?, ?, ?, ?, NULL, NULL)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name
  `).run(repoPath, name, now, now);
}

export function recordRepoSessions(repoPath: string, sessions: RepoSessionRowInput[]) {
  recordRepoSessionRows(
    repoPath,
    sessions.map((session) => ({
      path: session.path,
      id: session.id,
      name: session.name,
      created: session.created,
      modified: session.modified,
      messageCount: session.messageCount,
      firstMessage: session.firstMessage,
    })),
  );
}

export function recordRepoSessionRows(repoPath: string, sessions: RepoSessionRowInput[]) {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec("BEGIN");

  try {
    ensureRepoStub(db, repoPath);
    const lastOpenedBySessionPath = new Map(
      db.prepare("SELECT session_path AS path, last_opened_at AS lastOpenedAt FROM repo_sessions WHERE repo_path = ?")
        .all(repoPath)
        .map((row) => [String(row.path), toOptionalString(row.lastOpenedAt)]),
    );
    const repoUsage = db.prepare(`
      SELECT last_opened_at AS lastOpenedAt, last_session_path AS lastSessionPath
      FROM recent_repos
      WHERE path = ?
    `).get(repoPath);
    const repoLastOpenedAt = toOptionalString(repoUsage?.lastOpenedAt);
    const repoLastSessionPath = toOptionalString(repoUsage?.lastSessionPath);

    db.prepare("DELETE FROM repo_sessions WHERE repo_path = ?").run(repoPath);

    const insert = db.prepare(`
      INSERT INTO repo_sessions (
        session_path,
        repo_path,
        session_id,
        name,
        created_at,
        modified_at,
        last_opened_at,
        message_count,
        first_message,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const session of sessions) {
      const lastOpenedAt = lastOpenedBySessionPath.get(session.path) ?? (
        session.path === repoLastSessionPath ? repoLastOpenedAt : undefined
      );

      insert.run(
        session.path,
        repoPath,
        session.id,
        session.name ?? null,
        session.created,
        session.modified,
        lastOpenedAt ?? null,
        session.messageCount,
        session.firstMessage,
        now,
      );
    }

    db.prepare(`
      UPDATE recent_repos
      SET sessions_indexed_at = ?
      WHERE path = ?
    `).run(now, repoPath);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function recordSessionWorktree(repoPath: string, sessionPath: string, worktreePath: string) {
  const db = getDatabase();
  const createdAt = new Date().toISOString();

  ensureRepoStub(db, repoPath);
  db.prepare(`
    INSERT INTO session_worktrees (session_path, repo_path, worktree_path, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_path) DO UPDATE SET
      repo_path = excluded.repo_path,
      worktree_path = excluded.worktree_path
  `).run(sessionPath, repoPath, worktreePath, createdAt);
}

export function getSessionWorktree(sessionPath: string) {
  const row = getDatabase().prepare(`
    SELECT
      session_path AS sessionPath,
      repo_path AS repoPath,
      worktree_path AS worktreePath
    FROM session_worktrees
    WHERE session_path = ?
  `).get(sessionPath);

  if (!row) {
    return undefined;
  }

  return {
    sessionPath: String(row.sessionPath),
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
      session_path AS sessionPath,
      repo_path AS repoPath,
      worktree_path AS worktreePath
    FROM session_worktrees
    WHERE repo_path = ?
    ORDER BY created_at DESC
  `).all(repoPath).map((row) => ({
    sessionPath: String(row.sessionPath),
    repoPath: String(row.repoPath),
    worktreePath: String(row.worktreePath),
  }));
}

export function getAllSessionWorktrees(): SessionWorktreePreference[] {
  return getDatabase().prepare(`
    SELECT
      worktrees.session_path AS sessionPath,
      worktrees.repo_path AS repoPath,
      repos.name AS repoName,
      worktrees.worktree_path AS worktreePath,
      sessions.session_id AS sessionId,
      sessions.name AS sessionName
    FROM session_worktrees AS worktrees
    LEFT JOIN recent_repos AS repos
      ON repos.path = worktrees.repo_path
    LEFT JOIN repo_sessions AS sessions
      ON sessions.session_path = worktrees.session_path
    ORDER BY repos.name ASC, worktrees.created_at DESC
  `).all().map((row) => ({
    sessionPath: String(row.sessionPath),
    repoPath: String(row.repoPath),
    repoName: toOptionalString(row.repoName) ?? basename(String(row.repoPath)),
    worktreePath: String(row.worktreePath),
    sessionId: toOptionalString(row.sessionId),
    sessionName: toOptionalString(row.sessionName),
  }));
}

export function removeSessionWorktreeMapping(sessionPath: string) {
  getDatabase().prepare("DELETE FROM session_worktrees WHERE session_path = ?").run(sessionPath);
}

export function removeIndexedRepo(repoPath: string) {
  const db = getDatabase();
  const lastSelectedRepoPath = getSetting(db, "lastSelectedRepoPath");
  const lastSelectedSessionPath = getSetting(db, "lastSelectedSessionPath");
  const repoSessionPaths = new Set(
    db.prepare("SELECT session_path AS path FROM repo_sessions WHERE repo_path = ?")
      .all(repoPath)
      .map((row) => String(row.path)),
  );

  db.exec("BEGIN");

  try {
    db.prepare("DELETE FROM recent_repos WHERE path = ?").run(repoPath);

    if (lastSelectedRepoPath === repoPath) {
      deleteSetting(db, "lastSelectedRepoPath");
    }

    if (lastSelectedSessionPath && repoSessionPaths.has(lastSelectedSessionPath)) {
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
    clearSessionMessageCachesRows(db);
    deleteSetting(db, "lastSelectedRepoPath");
    deleteSetting(db, "lastSelectedSessionPath");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getPreferences();
}

export function removeIndexedSession(sessionPath: string, options: { removeWorktreeMapping?: boolean } = {}) {
  const db = getDatabase();
  const lastSelectedSessionPath = getSetting(db, "lastSelectedSessionPath");
  const removeWorktreeMapping = options.removeWorktreeMapping ?? true;

  db.prepare("DELETE FROM repo_sessions WHERE session_path = ?").run(sessionPath);
  deleteSessionMessageCacheRow(db, sessionPath);

  if (removeWorktreeMapping) {
    db.prepare("DELETE FROM session_worktrees WHERE session_path = ?").run(sessionPath);
  }

  if (lastSelectedSessionPath === sessionPath) {
    deleteSetting(db, "lastSelectedSessionPath");
  }
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

export function getSessionMessageCache(sessionPath: string) {
  return getSessionMessageCacheRow(getDatabase(), sessionPath);
}

export function upsertSessionMessageCache(input: SessionMessageCacheUpsert) {
  const db = getDatabase();
  ensureRepoStub(db, input.repoPath);
  upsertSessionMessageCacheRow(db, input);
}

export function touchSessionMessageCache(sessionPath: string) {
  touchSessionMessageCacheRow(getDatabase(), sessionPath);
}

export function deleteSessionMessageCache(sessionPath: string) {
  deleteSessionMessageCacheRow(getDatabase(), sessionPath);
}

export function clearSessionMessageCaches() {
  clearSessionMessageCachesRows(getDatabase());
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

function recordSessionOpened(db: DatabaseSync, sessionPath: string, openedAt: string) {
  db.prepare("UPDATE repo_sessions SET last_opened_at = ? WHERE session_path = ?").run(openedAt, sessionPath);
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function basename(value: string) {
  const clean = value.replace(/\/+$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1) || clean;
}
