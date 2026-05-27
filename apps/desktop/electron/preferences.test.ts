import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { getIndexedSessions } from "./preferences-indexed-sessions.js";

function createPreferencesDatabase() {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE recent_repos (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      last_opened_at TEXT NOT NULL,
      last_session_path TEXT,
      sessions_indexed_at TEXT
    );

    CREATE TABLE repo_sessions (
      session_path TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      session_id TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      first_message TEXT NOT NULL DEFAULT '',
      indexed_at TEXT NOT NULL
    );

    CREATE TABLE session_worktrees (
      session_path TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      worktree_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return db;
}

test("getIndexedSessions qualifies joined session columns", () => {
  const db = createPreferencesDatabase();

  try {
    db.prepare(`
      INSERT INTO repo_sessions (
        session_path,
        repo_path,
        session_id,
        name,
        created_at,
        modified_at,
        message_count,
        first_message,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "/repo/.pi/sessions/session-a.json",
      "/repo",
      "session-a",
      "Session A",
      "2026-05-01T00:00:00.000Z",
      "2026-05-03T00:00:00.000Z",
      4,
      "first prompt",
      "2026-05-03T00:01:00.000Z",
    );

    db.prepare(`
      INSERT INTO repo_sessions (
        session_path,
        repo_path,
        session_id,
        name,
        created_at,
        modified_at,
        message_count,
        first_message,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "/repo/.pi/sessions/session-b.json",
      "/repo",
      "session-b",
      null,
      "2026-05-01T00:00:00.000Z",
      "2026-05-02T00:00:00.000Z",
      1,
      "",
      "2026-05-02T00:01:00.000Z",
    );

    db.prepare(`
      INSERT INTO session_worktrees (session_path, repo_path, worktree_path, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      "/repo/.pi/sessions/session-a.json",
      "/repo",
      "/repo/worktrees/session-a",
      "2026-05-03T00:02:00.000Z",
    );

    const sessions = getIndexedSessions(db);

    assert.deepEqual(sessions, [
      {
        path: "/repo/.pi/sessions/session-a.json",
        repoPath: "/repo",
        worktreePath: "/repo/worktrees/session-a",
        id: "session-a",
        name: "Session A",
        created: "2026-05-01T00:00:00.000Z",
        modified: "2026-05-03T00:00:00.000Z",
        messageCount: 4,
        firstMessage: "first prompt",
      },
      {
        path: "/repo/.pi/sessions/session-b.json",
        repoPath: "/repo",
        worktreePath: undefined,
        id: "session-b",
        name: undefined,
        created: "2026-05-01T00:00:00.000Z",
        modified: "2026-05-02T00:00:00.000Z",
        messageCount: 1,
        firstMessage: "",
      },
    ]);
  } finally {
    db.close();
  }
});
