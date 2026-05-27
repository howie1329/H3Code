import type { DatabaseSync } from "node:sqlite";

export type RecentRepoPreference = {
  path: string;
  name: string;
  addedAt: string;
  lastOpenedAt: string;
  lastSessionPath?: string;
  sessionsIndexedAt?: string;
};

export function migrateRecentReposSchema(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(recent_repos)").all() as Array<{ name: string }>;
  const hasSessionsIndexedAt = columns.some((column) => column.name === "sessions_indexed_at");
  const hasAddedAt = columns.some((column) => column.name === "added_at");

  if (!hasAddedAt) {
    db.exec("ALTER TABLE recent_repos ADD COLUMN added_at TEXT");
    db.exec("UPDATE recent_repos SET added_at = last_opened_at WHERE added_at IS NULL");
  }

  if (!hasSessionsIndexedAt) {
    db.exec("ALTER TABLE recent_repos ADD COLUMN sessions_indexed_at TEXT");
  }
}

export function migrateRepoSessionsSchema(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(repo_sessions)").all() as Array<{ name: string }>;
  const hasLastOpenedAt = columns.some((column) => column.name === "last_opened_at");

  if (!hasLastOpenedAt) {
    db.exec("ALTER TABLE repo_sessions ADD COLUMN last_opened_at TEXT");
  }
}

export function getRecentRepos(db: DatabaseSync, limit: number): RecentRepoPreference[] {
  return db.prepare(`
    SELECT
      path,
      name,
      added_at AS addedAt,
      last_opened_at AS lastOpenedAt,
      last_session_path AS lastSessionPath,
      sessions_indexed_at AS sessionsIndexedAt
    FROM recent_repos
    ORDER BY added_at ASC
    LIMIT ?
  `).all(limit).map((row) => ({
    path: String(row.path),
    name: String(row.name),
    addedAt: String(row.addedAt),
    lastOpenedAt: String(row.lastOpenedAt),
    lastSessionPath: toOptionalString(row.lastSessionPath),
    sessionsIndexedAt: toOptionalString(row.sessionsIndexedAt),
  }));
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
