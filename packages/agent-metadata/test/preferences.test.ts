import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { getIndexedSessions } from "../src/preferences-indexed-sessions.js";
import {
  getRecentRepos,
  migrateRecentReposSchema,
  migrateRepoSessionsSchema,
} from "../src/preferences-schema.js";

function createPreferencesDatabase() {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE recent_repos (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      added_at TEXT NOT NULL,
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
      last_opened_at TEXT,
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
        last_opened_at,
        message_count,
        first_message,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "/repo/.pi/sessions/session-a.json",
      "/repo",
      "session-a",
      "Session A",
      "2026-05-01T00:00:00.000Z",
      "2026-05-03T00:00:00.000Z",
      null,
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
        last_opened_at,
        message_count,
        first_message,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "/repo/.pi/sessions/session-b.json",
      "/repo",
      "session-b",
      null,
      "2026-05-01T00:00:00.000Z",
      "2026-05-02T00:00:00.000Z",
      null,
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
        lastOpenedAt: undefined,
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
        lastOpenedAt: undefined,
        messageCount: 1,
        firstMessage: "",
      },
    ]);
  } finally {
    db.close();
  }
});

test("getRecentRepos uses added order instead of last-opened order", () => {
  const db = createPreferencesDatabase();

  try {
    const insert = db.prepare(`
      INSERT INTO recent_repos (path, name, added_at, last_opened_at)
      VALUES (?, ?, ?, ?)
    `);

    insert.run("/repo-a", "repo-a", "2026-05-01T00:00:00.000Z", "2026-05-03T00:00:00.000Z");
    insert.run("/repo-b", "repo-b", "2026-05-02T00:00:00.000Z", "2026-05-04T00:00:00.000Z");

    assert.deepEqual(getRecentRepos(db, 10).map((repo) => repo.path), ["/repo-a", "/repo-b"]);
  } finally {
    db.close();
  }
});

test("migrateRecentReposSchema backfills added order from last opened", () => {
  const db = new DatabaseSync(":memory:");

  try {
    db.exec(`
      CREATE TABLE recent_repos (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        last_opened_at TEXT NOT NULL,
        last_session_path TEXT
      );
    `);

    db.prepare(`
      INSERT INTO recent_repos (path, name, last_opened_at)
      VALUES (?, ?, ?), (?, ?, ?)
    `).run(
      "/repo-a",
      "repo-a",
      "2026-05-01T00:00:00.000Z",
      "/repo-b",
      "repo-b",
      "2026-05-02T00:00:00.000Z",
    );

    migrateRecentReposSchema(db);

    const repos = getRecentRepos(db, 10);

    assert.deepEqual(repos.map((repo) => repo.path), ["/repo-a", "/repo-b"]);
    assert.equal(repos[0]?.addedAt, "2026-05-01T00:00:00.000Z");
    assert.equal(repos[0]?.sessionsIndexedAt, undefined);
  } finally {
    db.close();
  }
});

test("getIndexedSessions prefers recently opened sessions over older modified sessions", () => {
  const db = createPreferencesDatabase();

  try {
    const insert = db.prepare(`
      INSERT INTO repo_sessions (
        session_path,
        repo_path,
        session_id,
        name,
        created_at,
        modified_at,
        last_opened_at,
        message_count,
        first_message,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      "/repo/.pi/sessions/opened.json",
      "/repo",
      "opened",
      "Opened",
      "2026-05-01T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z",
      "2026-05-04T00:00:00.000Z",
      1,
      "",
      "2026-05-04T00:01:00.000Z",
    );

    insert.run(
      "/repo/.pi/sessions/modified.json",
      "/repo",
      "modified",
      "Modified",
      "2026-05-01T00:00:00.000Z",
      "2026-05-03T00:00:00.000Z",
      null,
      1,
      "",
      "2026-05-03T00:01:00.000Z",
    );

    assert.deepEqual(getIndexedSessions(db).map((session) => session.id), ["opened", "modified"]);
  } finally {
    db.close();
  }
});

test("getIndexedSessions uses modified time when it is newer than last opened", () => {
  const db = createPreferencesDatabase();

  try {
    const insert = db.prepare(`
      INSERT INTO repo_sessions (
        session_path,
        repo_path,
        session_id,
        name,
        created_at,
        modified_at,
        last_opened_at,
        message_count,
        first_message,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      "/repo/.pi/sessions/modified-after-open.json",
      "/repo",
      "modified-after-open",
      "Modified after open",
      "2026-05-01T00:00:00.000Z",
      "2026-05-05T00:00:00.000Z",
      "2026-05-02T00:00:00.000Z",
      1,
      "",
      "2026-05-05T00:01:00.000Z",
    );

    insert.run(
      "/repo/.pi/sessions/opened.json",
      "/repo",
      "opened",
      "Opened",
      "2026-05-01T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z",
      "2026-05-04T00:00:00.000Z",
      1,
      "",
      "2026-05-04T00:01:00.000Z",
    );

    assert.deepEqual(getIndexedSessions(db).map((session) => session.id), ["modified-after-open", "opened"]);
  } finally {
    db.close();
  }
});

test("migrateRepoSessionsSchema adds optional session last opened column", () => {
  const db = new DatabaseSync(":memory:");

  try {
    db.exec(`
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
    `);

    migrateRepoSessionsSchema(db);

    const columns = db.prepare("PRAGMA table_info(repo_sessions)").all() as Array<{ name: string }>;
    assert.equal(columns.some((column) => column.name === "last_opened_at"), true);
  } finally {
    db.close();
  }
});
