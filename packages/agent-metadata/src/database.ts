import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { getConfiguredDataDir } from "./config.js";
import { migrateRecentReposSchema } from "./preferences-schema.js";
import { migrateSessionCacheSchema } from "./session-cache.js";
import { migrateRegisteredSessionsSchema } from "./session-registry.js";

let database: DatabaseSync | undefined;
let databasePath: string | undefined;

export function getDatabase() {
  if (database) {
    return database;
  }

  mkdirSync(getConfiguredDataDir(), { recursive: true });
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
  `);

  migrateRecentReposSchema(database);
  migrateRegisteredSessionsSchema(database);
  migrateSessionCacheSchema(database);

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
