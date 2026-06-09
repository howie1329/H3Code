import type { DatabaseSync } from "node:sqlite";

import { ensureRepoStub } from "./preferences-repo.js";

export type RegisterH3CodeSessionInput = {
  h3codeSessionId: string;
  repoPath: string;
  providerId: string;
  providerSessionRef: string;
  providerSessionId?: string;
  name?: string;
  created?: string;
  modified?: string;
  messageCount?: number;
  firstMessage?: string;
};

export type RegisteredSessionMetadataPatch = {
  name?: string;
  modified?: string;
  messageCount?: number;
  firstMessage?: string;
  providerSessionRef?: string;
  providerSessionId?: string;
};

export function migrateRegisteredSessionsSchema(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(repo_sessions)").all() as Array<{ name: string }>;
  const hasH3CodeSessionId = columns.some((column) => column.name === "h3code_session_id");

  if (hasH3CodeSessionId) {
    return;
  }

  db.exec("DROP TABLE IF EXISTS session_worktrees");
  db.exec("DROP TABLE IF EXISTS repo_sessions");
  db.exec(`
    CREATE TABLE repo_sessions (
      h3code_session_id TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      provider_id TEXT NOT NULL DEFAULT 'pi',
      provider_session_ref TEXT NOT NULL,
      provider_session_id TEXT,
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

    CREATE TABLE session_worktrees (
      h3code_session_id TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      worktree_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(h3code_session_id) REFERENCES repo_sessions(h3code_session_id) ON DELETE CASCADE,
      FOREIGN KEY(repo_path) REFERENCES recent_repos(path) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS session_worktrees_repo_idx
      ON session_worktrees(repo_path);
  `);
}

export function registerH3CodeSession(db: DatabaseSync, input: RegisterH3CodeSessionInput) {
  ensureRepoStub(db, input.repoPath);
  const now = new Date().toISOString();
  const created = input.created ?? now;
  const modified = input.modified ?? now;

  db.prepare(`
    INSERT INTO repo_sessions (
      h3code_session_id,
      repo_path,
      provider_id,
      provider_session_ref,
      provider_session_id,
      name,
      created_at,
      modified_at,
      last_opened_at,
      message_count,
      first_message,
      indexed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(h3code_session_id) DO UPDATE SET
      repo_path = excluded.repo_path,
      provider_id = excluded.provider_id,
      provider_session_ref = excluded.provider_session_ref,
      provider_session_id = excluded.provider_session_id,
      name = excluded.name,
      modified_at = excluded.modified_at,
      message_count = excluded.message_count,
      first_message = excluded.first_message,
      indexed_at = excluded.indexed_at
  `).run(
    input.h3codeSessionId,
    input.repoPath,
    input.providerId,
    input.providerSessionRef,
    input.providerSessionId ?? null,
    input.name ?? null,
    created,
    modified,
    null,
    input.messageCount ?? 0,
    input.firstMessage ?? "",
    now,
  );
}

export function isRegisteredSession(db: DatabaseSync, h3codeSessionId: string) {
  const row = db.prepare(`
    SELECT h3code_session_id AS id
    FROM repo_sessions
    WHERE h3code_session_id = ?
  `).get(h3codeSessionId);

  return Boolean(row);
}

export function getRegisteredSession(db: DatabaseSync, h3codeSessionId: string) {
  const row = db.prepare(`
    SELECT
      h3code_session_id AS h3codeSessionId,
      repo_path AS repoPath,
      provider_id AS providerId,
      provider_session_ref AS providerSessionRef,
      provider_session_id AS providerSessionId,
      name,
      created_at AS createdAt,
      modified_at AS modifiedAt,
      last_opened_at AS lastOpenedAt,
      message_count AS messageCount,
      first_message AS firstMessage
    FROM repo_sessions
    WHERE h3code_session_id = ?
  `).get(h3codeSessionId);

  if (!row) {
    return undefined;
  }

  const record = row as Record<string, unknown>;
  return {
    h3codeSessionId: String(record.h3codeSessionId),
    repoPath: String(record.repoPath),
    providerId: String(record.providerId),
    providerSessionRef: String(record.providerSessionRef),
    providerSessionId: toOptionalString(record.providerSessionId),
    name: toOptionalString(record.name),
    createdAt: String(record.createdAt),
    modifiedAt: String(record.modifiedAt),
    lastOpenedAt: toOptionalString(record.lastOpenedAt),
    messageCount: Number(record.messageCount),
    firstMessage: String(record.firstMessage),
  };
}

export function touchRegisteredSession(db: DatabaseSync, h3codeSessionId: string) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE repo_sessions
    SET last_opened_at = ?
    WHERE h3code_session_id = ?
  `).run(now, h3codeSessionId);
}

export function updateRegisteredSessionMetadata(
  db: DatabaseSync,
  h3codeSessionId: string,
  patch: RegisteredSessionMetadataPatch,
) {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.modified !== undefined) {
    fields.push("modified_at = ?");
    values.push(patch.modified);
  }
  if (patch.messageCount !== undefined) {
    fields.push("message_count = ?");
    values.push(patch.messageCount);
  }
  if (patch.firstMessage !== undefined) {
    fields.push("first_message = ?");
    values.push(patch.firstMessage);
  }
  if (patch.providerSessionRef !== undefined) {
    fields.push("provider_session_ref = ?");
    values.push(patch.providerSessionRef);
  }
  if (patch.providerSessionId !== undefined) {
    fields.push("provider_session_id = ?");
    values.push(patch.providerSessionId);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(h3codeSessionId);
  db.prepare(`UPDATE repo_sessions SET ${fields.join(", ")} WHERE h3code_session_id = ?`).run(...values);
}

export function removeRegisteredSession(db: DatabaseSync, h3codeSessionId: string) {
  db.prepare("DELETE FROM repo_sessions WHERE h3code_session_id = ?").run(h3codeSessionId);
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
