import type { DatabaseSync } from "node:sqlite";

export function ensureRepoStub(db: DatabaseSync, repoPath: string) {
  const name = basename(repoPath);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO recent_repos (path, name, added_at, last_opened_at, last_session_path, sessions_indexed_at)
    VALUES (?, ?, ?, ?, NULL, NULL)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name
  `).run(repoPath, name, now, now);
}

function basename(value: string) {
  const clean = value.replace(/\/+$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1) || clean;
}
