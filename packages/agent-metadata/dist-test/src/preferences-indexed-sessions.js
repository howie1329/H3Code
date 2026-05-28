export function getIndexedSessions(db) {
    return db.prepare(`
    SELECT
      sessions.session_path AS path,
      sessions.repo_path AS repoPath,
      sessions.session_id AS id,
      worktrees.worktree_path AS worktreePath,
      sessions.name,
      sessions.created_at AS created,
      sessions.modified_at AS modified,
      sessions.last_opened_at AS lastOpenedAt,
      sessions.message_count AS messageCount,
      sessions.first_message AS firstMessage
    FROM repo_sessions AS sessions
    LEFT JOIN session_worktrees AS worktrees
      ON worktrees.session_path = sessions.session_path
    ORDER BY
      CASE
        WHEN sessions.last_opened_at > sessions.modified_at THEN sessions.last_opened_at
        ELSE sessions.modified_at
      END DESC,
      sessions.modified_at DESC
  `).all().map((row) => ({
        path: String(row.path),
        repoPath: String(row.repoPath),
        worktreePath: toOptionalString(row.worktreePath),
        id: String(row.id),
        name: toOptionalString(row.name),
        created: String(row.created),
        modified: String(row.modified),
        lastOpenedAt: toOptionalString(row.lastOpenedAt),
        messageCount: Number(row.messageCount),
        firstMessage: String(row.firstMessage),
    }));
}
function toOptionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
//# sourceMappingURL=preferences-indexed-sessions.js.map