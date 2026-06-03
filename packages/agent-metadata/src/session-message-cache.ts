import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

export const DEFAULT_SESSION_MESSAGE_CACHE_MAX_ENTRIES = 100;

export type SessionMessageCacheSyncStatus = "fresh" | "stale" | "syncing" | "error";

export type SessionMessageCacheState = {
  isStreaming?: boolean;
  isCompacting?: boolean;
  sessionFile?: string;
  sessionId?: string;
};

export type SessionMessageCacheEntry = {
  sessionPath: string;
  repoPath: string;
  providerId?: string;
  messages: unknown[];
  sessionState?: SessionMessageCacheState;
  messageCount: number;
  sourceMtimeMs?: number;
  sourceSizeBytes?: number;
  contentHash: string;
  cachedAt: string;
  syncedAt?: string;
  lastOpenedAt: string;
  syncStatus?: SessionMessageCacheSyncStatus;
};

export type SessionMessageCacheUpsert = Omit<
  SessionMessageCacheEntry,
  "contentHash" | "cachedAt" | "messageCount" | "lastOpenedAt"
> & {
  messageCount?: number;
  lastOpenedAt?: string;
  contentHash?: string;
  cachedAt?: string;
};

export function migrateSessionMessageCacheSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_message_cache (
      session_path TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      provider_id TEXT NOT NULL DEFAULT 'pi',
      messages_json TEXT NOT NULL,
      session_state_json TEXT,
      message_count INTEGER NOT NULL,
      source_mtime_ms INTEGER,
      source_size_bytes INTEGER,
      content_hash TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      synced_at TEXT,
      last_opened_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'fresh',
      FOREIGN KEY(repo_path) REFERENCES recent_repos(path) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS session_message_cache_repo_opened_idx
      ON session_message_cache(repo_path, last_opened_at DESC);
  `);
}

export function getSessionMessageCache(
  db: DatabaseSync,
  sessionPath: string,
): SessionMessageCacheEntry | undefined {
  const row = db.prepare(`
    SELECT
      session_path AS sessionPath,
      repo_path AS repoPath,
      provider_id AS providerId,
      messages_json AS messagesJson,
      session_state_json AS sessionStateJson,
      message_count AS messageCount,
      source_mtime_ms AS sourceMtimeMs,
      source_size_bytes AS sourceSizeBytes,
      content_hash AS contentHash,
      cached_at AS cachedAt,
      synced_at AS syncedAt,
      last_opened_at AS lastOpenedAt,
      sync_status AS syncStatus
    FROM session_message_cache
    WHERE session_path = ?
  `).get(sessionPath);

  if (!row) {
    return undefined;
  }

  return rowToEntry(row);
}

export function upsertSessionMessageCache(db: DatabaseSync, input: SessionMessageCacheUpsert) {
  const messagesJson = JSON.stringify(input.messages);
  const contentHash = input.contentHash ?? hashContent(messagesJson);
  const now = new Date().toISOString();
  const cachedAt = input.cachedAt ?? now;
  const lastOpenedAt = input.lastOpenedAt ?? now;
  const messageCount = input.messageCount ?? input.messages.length;
  const sessionStateJson = input.sessionState ? JSON.stringify(input.sessionState) : null;
  const sourceStats = readSourceStats(input.sessionPath);
  const syncStatus = input.syncStatus ?? "fresh";

  db.prepare(`
    INSERT INTO session_message_cache (
      session_path,
      repo_path,
      provider_id,
      messages_json,
      session_state_json,
      message_count,
      source_mtime_ms,
      source_size_bytes,
      content_hash,
      cached_at,
      synced_at,
      last_opened_at,
      sync_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_path) DO UPDATE SET
      repo_path = excluded.repo_path,
      provider_id = excluded.provider_id,
      messages_json = excluded.messages_json,
      session_state_json = excluded.session_state_json,
      message_count = excluded.message_count,
      source_mtime_ms = excluded.source_mtime_ms,
      source_size_bytes = excluded.source_size_bytes,
      content_hash = excluded.content_hash,
      cached_at = excluded.cached_at,
      synced_at = excluded.synced_at,
      last_opened_at = excluded.last_opened_at,
      sync_status = excluded.sync_status
  `).run(
    input.sessionPath,
    input.repoPath,
    input.providerId ?? "pi",
    messagesJson,
    sessionStateJson,
    messageCount,
    sourceStats?.mtimeMs ?? input.sourceMtimeMs ?? null,
    sourceStats?.sizeBytes ?? input.sourceSizeBytes ?? null,
    contentHash,
    cachedAt,
    input.syncedAt ?? now,
    lastOpenedAt,
    syncStatus,
  );

  evictSessionMessageCaches(db, DEFAULT_SESSION_MESSAGE_CACHE_MAX_ENTRIES);
}

export function touchSessionMessageCache(db: DatabaseSync, sessionPath: string) {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE session_message_cache
    SET last_opened_at = ?
    WHERE session_path = ?
  `).run(now, sessionPath);
}

export function deleteSessionMessageCache(db: DatabaseSync, sessionPath: string) {
  db.prepare("DELETE FROM session_message_cache WHERE session_path = ?").run(sessionPath);
}

export function clearSessionMessageCaches(db: DatabaseSync) {
  db.exec("DELETE FROM session_message_cache");
}

export function evictSessionMessageCaches(
  db: DatabaseSync,
  maxEntries = DEFAULT_SESSION_MESSAGE_CACHE_MAX_ENTRIES,
) {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM session_message_cache").get() as {
    count: number;
  };
  const count = Number(countRow.count);

  if (count <= maxEntries) {
    return;
  }

  const excess = count - maxEntries;

  db.prepare(`
    DELETE FROM session_message_cache
    WHERE session_path IN (
      SELECT session_path
      FROM session_message_cache
      ORDER BY last_opened_at ASC
      LIMIT ?
    )
  `).run(excess);
}

export function hashContent(messagesJson: string) {
  return createHash("sha256").update(messagesJson).digest("hex");
}

function readSourceStats(sessionPath: string) {
  try {
    const stats = statSync(sessionPath);

    return {
      mtimeMs: stats.mtimeMs,
      sizeBytes: stats.size,
    };
  } catch {
    return undefined;
  }
}

function rowToEntry(row: Record<string, unknown>): SessionMessageCacheEntry {
  let messages: unknown[] = [];
  let sessionState: SessionMessageCacheState | undefined;

  try {
    messages = JSON.parse(String(row.messagesJson)) as unknown[];
  } catch {
    messages = [];
  }

  if (row.sessionStateJson) {
    try {
      sessionState = JSON.parse(String(row.sessionStateJson)) as SessionMessageCacheState;
    } catch {
      sessionState = undefined;
    }
  }

  return {
    sessionPath: String(row.sessionPath),
    repoPath: String(row.repoPath),
    providerId: String(row.providerId),
    messages,
    sessionState,
    messageCount: Number(row.messageCount),
    sourceMtimeMs: toOptionalNumber(row.sourceMtimeMs),
    sourceSizeBytes: toOptionalNumber(row.sourceSizeBytes),
    contentHash: String(row.contentHash),
    cachedAt: String(row.cachedAt),
    syncedAt: toOptionalString(row.syncedAt),
    lastOpenedAt: String(row.lastOpenedAt),
    syncStatus: (row.syncStatus as SessionMessageCacheSyncStatus) ?? "fresh",
  };
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
