import { app } from "electron";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

import type { SessionInfo } from "@earendil-works/pi-coding-agent";

export type DesktopSettings = {
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  preferDiffPanel: boolean;
  autoConnectOnLaunch: boolean;
};

export type RecentRepoPreference = {
  path: string;
  name: string;
  lastOpenedAt: string;
  lastSessionPath?: string;
  sessionsIndexedAt?: string;
};

export type IndexedSessionPreference = {
  path: string;
  repoPath: string;
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

let database: DatabaseSync | undefined;
let databasePath: string | undefined;

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
    INSERT INTO recent_repos (path, name, last_opened_at, last_session_path)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      last_opened_at = excluded.last_opened_at,
      last_session_path = COALESCE(excluded.last_session_path, recent_repos.last_session_path)
  `).run(repoPath, name, lastOpenedAt, lastSessionPath ?? null);

  setSetting(db, "lastSelectedRepoPath", repoPath);

  if (lastSessionPath) {
    setSetting(db, "lastSelectedSessionPath", lastSessionPath);
  }

  trimRecentRepos(db);
}

function ensureRepoStub(db: DatabaseSync, repoPath: string) {
  const name = basename(repoPath);
  const lastOpenedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO recent_repos (path, name, last_opened_at, last_session_path, sessions_indexed_at)
    VALUES (?, ?, ?, NULL, NULL)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name
  `).run(repoPath, name, lastOpenedAt);
}

export function recordRepoSessions(repoPath: string, sessions: SessionInfo[]) {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec("BEGIN");

  try {
    ensureRepoStub(db, repoPath);
    db.prepare("DELETE FROM repo_sessions WHERE repo_path = ?").run(repoPath);

    const insert = db.prepare(`
      INSERT INTO repo_sessions (
        session_path,
        repo_path,
        session_id,
        name,
        created_at,
        modified_at,
        message_count,
        first_message,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const session of sessions) {
      insert.run(
        session.path,
        repoPath,
        session.id,
        session.name ?? null,
        session.created.toISOString(),
        session.modified.toISOString(),
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
    deleteSetting(db, "lastSelectedRepoPath");
    deleteSetting(db, "lastSelectedSessionPath");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getPreferences();
}

export function removeIndexedSession(sessionPath: string) {
  const db = getDatabase();
  const lastSelectedSessionPath = getSetting(db, "lastSelectedSessionPath");

  db.prepare("DELETE FROM repo_sessions WHERE session_path = ?").run(sessionPath);

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
  database?.close();
  database = undefined;
}

function getDatabase() {
  if (database) {
    return database;
  }

  database = new DatabaseSync(getDatabasePath());
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recent_repos (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      last_opened_at TEXT NOT NULL,
      last_session_path TEXT,
      sessions_indexed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS repo_sessions (
      session_path TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      session_id TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      first_message TEXT NOT NULL DEFAULT '',
      indexed_at TEXT NOT NULL,
      FOREIGN KEY(repo_path) REFERENCES recent_repos(path) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS repo_sessions_repo_modified_idx
      ON repo_sessions(repo_path, modified_at DESC);
  `);

  migrateRecentReposSchema(database);

  return database;
}

function migrateRecentReposSchema(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(recent_repos)").all() as Array<{ name: string }>;
  const hasSessionsIndexedAt = columns.some((column) => column.name === "sessions_indexed_at");

  if (!hasSessionsIndexedAt) {
    db.exec("ALTER TABLE recent_repos ADD COLUMN sessions_indexed_at TEXT");
  }
}

function getDatabasePath() {
  databasePath ??= path.join(app.getPath("userData"), "h3code.sqlite");
  return databasePath;
}

function getRecentRepos(db: DatabaseSync): RecentRepoPreference[] {
  return db.prepare(`
    SELECT
      path,
      name,
      last_opened_at AS lastOpenedAt,
      last_session_path AS lastSessionPath,
      sessions_indexed_at AS sessionsIndexedAt
    FROM recent_repos
    ORDER BY last_opened_at DESC
    LIMIT ?
  `).all(recentRepoLimit).map((row) => ({
    path: String(row.path),
    name: String(row.name),
    lastOpenedAt: String(row.lastOpenedAt),
    lastSessionPath: toOptionalString(row.lastSessionPath),
    sessionsIndexedAt: toOptionalString(row.sessionsIndexedAt),
  }));
}

function getIndexedSessions(db: DatabaseSync): IndexedSessionPreference[] {
  return db.prepare(`
    SELECT
      session_path AS path,
      repo_path AS repoPath,
      session_id AS id,
      name,
      created_at AS created,
      modified_at AS modified,
      message_count AS messageCount,
      first_message AS firstMessage
    FROM repo_sessions
    ORDER BY modified_at DESC
  `).all().map((row) => ({
    path: String(row.path),
    repoPath: String(row.repoPath),
    id: String(row.id),
    name: toOptionalString(row.name),
    created: String(row.created),
    modified: String(row.modified),
    messageCount: Number(row.messageCount),
    firstMessage: String(row.firstMessage),
  }));
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
      ORDER BY last_opened_at DESC
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
