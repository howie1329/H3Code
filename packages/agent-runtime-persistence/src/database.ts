import { DatabaseSync } from "node:sqlite";
import path from "node:path";

import { getConfiguredDataDir } from "./config.js";

let database: DatabaseSync | undefined;
let databasePath: string | undefined;

export function getDatabase() {
  if (database) {
    return database;
  }

  database = new DatabaseSync(getDatabasePath());
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  migrateSchema(database);

  return database;
}

function migrateSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_sessions (
      session_id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      repo_path TEXT NOT NULL,
      provider_session_ref TEXT,
      status TEXT NOT NULL,
      active_turn_id TEXT,
      title TEXT,
      model_json TEXT,
      thinking_level TEXT,
      queue_settings_json TEXT,
      auto_compaction_enabled INTEGER,
      token_usage_json TEXT,
      diff_summary_json TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runtime_messages (
      message_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      turn_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES runtime_sessions(session_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS runtime_messages_session_idx
      ON runtime_messages(session_id, created_at);

    CREATE TABLE IF NOT EXISTS runtime_activities (
      activity_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      turn_id TEXT,
      item_id TEXT,
      kind TEXT NOT NULL,
      title TEXT,
      content TEXT,
      status TEXT NOT NULL,
      input_json TEXT,
      output_json TEXT,
      error_text TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES runtime_sessions(session_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS runtime_activities_session_idx
      ON runtime_activities(session_id, created_at);

    CREATE TABLE IF NOT EXISTS runtime_pending_interactions (
      request_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      turn_id TEXT,
      item_id TEXT,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES runtime_sessions(session_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS runtime_pending_interactions_session_idx
      ON runtime_pending_interactions(session_id);

    CREATE TABLE IF NOT EXISTS runtime_bindings (
      session_id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      repo_path TEXT NOT NULL,
      provider_session_ref TEXT,
      resume_cursor_json TEXT,
      provider_options_json TEXT,
      status TEXT NOT NULL,
      active_turn_id TEXT,
      last_event TEXT,
      last_event_at INTEGER,
      FOREIGN KEY(session_id) REFERENCES runtime_sessions(session_id) ON DELETE CASCADE
    );
  `);
}

export function getDatabasePath() {
  databasePath ??= path.join(getConfiguredDataDir(), "runtime.db");
  return databasePath;
}

export function closePersistenceDatabase() {
  database?.close();
  database = undefined;
  databasePath = undefined;
}
