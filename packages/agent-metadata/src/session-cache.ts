import type { DatabaseSync } from "node:sqlite";

/** Opaque UIMessage-shaped JSON for display cache — not a canonical transcript store. */
export type SessionUiMessage = Record<string, unknown>;

export function migrateSessionCacheSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_ui_messages (
      h3code_session_id TEXT PRIMARY KEY,
      messages_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(h3code_session_id) REFERENCES repo_sessions(h3code_session_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS harness_resume_blobs (
      h3code_session_id TEXT PRIMARY KEY,
      resume_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(h3code_session_id) REFERENCES repo_sessions(h3code_session_id) ON DELETE CASCADE
    );
  `);
}

export function getSessionUiMessages(db: DatabaseSync, h3codeSessionId: string): SessionUiMessage[] | undefined {
  const row = db.prepare(`
    SELECT messages_json AS messagesJson
    FROM session_ui_messages
    WHERE h3code_session_id = ?
  `).get(h3codeSessionId) as { messagesJson?: string } | undefined;

  if (!row?.messagesJson) {
    return undefined;
  }

  return parseJsonArray(row.messagesJson);
}

export function saveSessionUiMessages(
  db: DatabaseSync,
  h3codeSessionId: string,
  messages: SessionUiMessage[],
) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO session_ui_messages (h3code_session_id, messages_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(h3code_session_id) DO UPDATE SET
      messages_json = excluded.messages_json,
      updated_at = excluded.updated_at
  `).run(h3codeSessionId, JSON.stringify(messages), now);
}

export function getHarnessResumeBlob(db: DatabaseSync, h3codeSessionId: string): unknown | undefined {
  const row = db.prepare(`
    SELECT resume_json AS resumeJson
    FROM harness_resume_blobs
    WHERE h3code_session_id = ?
  `).get(h3codeSessionId) as { resumeJson?: string } | undefined;

  if (!row?.resumeJson) {
    return undefined;
  }

  try {
    return JSON.parse(row.resumeJson) as unknown;
  } catch {
    return undefined;
  }
}

export function saveHarnessResumeBlob(db: DatabaseSync, h3codeSessionId: string, blob: unknown) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO harness_resume_blobs (h3code_session_id, resume_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(h3code_session_id) DO UPDATE SET
      resume_json = excluded.resume_json,
      updated_at = excluded.updated_at
  `).run(h3codeSessionId, JSON.stringify(blob), now);
}

export function deleteSessionCacheRows(db: DatabaseSync, h3codeSessionId: string) {
  db.prepare("DELETE FROM session_ui_messages WHERE h3code_session_id = ?").run(h3codeSessionId);
  db.prepare("DELETE FROM harness_resume_blobs WHERE h3code_session_id = ?").run(h3codeSessionId);
}

function parseJsonArray(raw: string): SessionUiMessage[] | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return undefined;
    }

    return parsed.filter((entry): entry is SessionUiMessage => typeof entry === "object" && entry !== null);
  } catch {
    return undefined;
  }
}
