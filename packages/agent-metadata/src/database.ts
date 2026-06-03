import { DatabaseSync } from "node:sqlite";
import path from "node:path";

import { getConfiguredDataDir } from "./config.js";
import { migrateRecentReposSchema, migrateRepoSessionsSchema } from "./preferences-schema.js";
import { migrateSessionMessageCacheSchema } from "./session-message-cache.js";

let database: DatabaseSync | undefined;
let databasePath: string | undefined;

export function getDatabase() {
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
      added_at TEXT NOT NULL,
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
      last_opened_at TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      first_message TEXT NOT NULL DEFAULT '',
      indexed_at TEXT NOT NULL,
      FOREIGN KEY(repo_path) REFERENCES recent_repos(path) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS repo_sessions_repo_modified_idx
      ON repo_sessions(repo_path, modified_at DESC);

    CREATE TABLE IF NOT EXISTS session_worktrees (
      session_path TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      worktree_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(repo_path) REFERENCES recent_repos(path) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS session_worktrees_repo_idx
      ON session_worktrees(repo_path);
  `);

  migrateRecentReposSchema(database);
  migrateRepoSessionsSchema(database);
  migrateSessionMessageCacheSchema(database);

  return database;
}

export function getDatabasePath() {
  databasePath ??= path.join(getConfiguredDataDir(), "h3code.sqlite");
  return databasePath;
}

export function closeDatabase() {
  database?.close();
  database = undefined;
  databasePath = undefined;
}
