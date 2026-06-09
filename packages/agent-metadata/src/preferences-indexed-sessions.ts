import type { DatabaseSync } from "node:sqlite";

export type IndexedSessionPreference = {
  id: string;
  providerSessionRef: string;
  repoPath: string;
  providerId: string;
  worktreePath?: string;
  providerSessionId?: string;
  name?: string;
  created: string;
  modified: string;
  lastOpenedAt?: string;
  messageCount: number;
  firstMessage: string;
  /** @deprecated Use providerSessionRef */
  path: string;
};

export function getIndexedSessions(db: DatabaseSync): IndexedSessionPreference[] {
  return db.prepare(`
    SELECT
      sessions.h3code_session_id AS id,
      sessions.provider_session_ref AS providerSessionRef,
      sessions.repo_path AS repoPath,
      sessions.provider_id AS providerId,
      sessions.provider_session_id AS providerSessionId,
      worktrees.worktree_path AS worktreePath,
      sessions.name,
      sessions.created_at AS created,
      sessions.modified_at AS modified,
      sessions.last_opened_at AS lastOpenedAt,
      sessions.message_count AS messageCount,
      sessions.first_message AS firstMessage
    FROM repo_sessions AS sessions
    LEFT JOIN session_worktrees AS worktrees
      ON worktrees.h3code_session_id = sessions.h3code_session_id
    ORDER BY
      CASE
        WHEN sessions.last_opened_at > sessions.modified_at THEN sessions.last_opened_at
        ELSE sessions.modified_at
      END DESC,
      sessions.modified_at DESC
  `).all().map(rowToIndexedSession);
}

export function getIndexedSessionsForRepo(db: DatabaseSync, repoPath: string): IndexedSessionPreference[] {
  return db.prepare(`
    SELECT
      sessions.h3code_session_id AS id,
      sessions.provider_session_ref AS providerSessionRef,
      sessions.repo_path AS repoPath,
      sessions.provider_id AS providerId,
      sessions.provider_session_id AS providerSessionId,
      worktrees.worktree_path AS worktreePath,
      sessions.name,
      sessions.created_at AS created,
      sessions.modified_at AS modified,
      sessions.last_opened_at AS lastOpenedAt,
      sessions.message_count AS messageCount,
      sessions.first_message AS firstMessage
    FROM repo_sessions AS sessions
    LEFT JOIN session_worktrees AS worktrees
      ON worktrees.h3code_session_id = sessions.h3code_session_id
    WHERE sessions.repo_path = ?
    ORDER BY
      CASE
        WHEN sessions.last_opened_at > sessions.modified_at THEN sessions.last_opened_at
        ELSE sessions.modified_at
      END DESC,
      sessions.modified_at DESC
  `).all(repoPath).map(rowToIndexedSession);
}

function rowToIndexedSession(row: Record<string, unknown>): IndexedSessionPreference {
  const providerSessionRef = String(row.providerSessionRef);

  return {
    id: String(row.id),
    providerSessionRef,
    path: providerSessionRef,
    repoPath: String(row.repoPath),
    providerId: String(row.providerId),
    worktreePath: toOptionalString(row.worktreePath),
    providerSessionId: toOptionalString(row.providerSessionId),
    name: toOptionalString(row.name),
    created: String(row.created),
    modified: String(row.modified),
    lastOpenedAt: toOptionalString(row.lastOpenedAt),
    messageCount: Number(row.messageCount),
    firstMessage: String(row.firstMessage),
  };
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
