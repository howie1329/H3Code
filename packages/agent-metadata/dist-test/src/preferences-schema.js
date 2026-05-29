export function migrateRecentReposSchema(db) {
    const columns = db.prepare("PRAGMA table_info(recent_repos)").all();
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
export function migrateRepoSessionsSchema(db) {
    const columns = db.prepare("PRAGMA table_info(repo_sessions)").all();
    const hasLastOpenedAt = columns.some((column) => column.name === "last_opened_at");
    if (!hasLastOpenedAt) {
        db.exec("ALTER TABLE repo_sessions ADD COLUMN last_opened_at TEXT");
    }
}
export function getRecentRepos(db, limit) {
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
function toOptionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
//# sourceMappingURL=preferences-schema.js.map