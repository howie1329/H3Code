import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { getIndexedSessions } from "../src/preferences-indexed-sessions.js";
import { getRecentRepos, migrateRecentReposSchema } from "../src/preferences-schema.js";
import { migrateRegisteredSessionsSchema, registerH3CodeSession } from "../src/session-registry.js";

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
  `);

  migrateRecentReposSchema(db);
  migrateRegisteredSessionsSchema(db);

  return db;
}

test("getIndexedSessions returns registered sessions by SessionId", () => {
  const db = createPreferencesDatabase();

  try {
    db.prepare(`
      INSERT INTO recent_repos (path, name, added_at, last_opened_at)
      VALUES (?, ?, ?, ?)
    `).run("/repo", "repo", "2026-05-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z");

    registerH3CodeSession(db, {
      h3codeSessionId: "h3-a",
      repoPath: "/repo",
      providerId: "pi",
      providerSessionRef: "/repo/.pi/sessions/session-a.json",
      name: "Session A",
      created: "2026-05-01T00:00:00.000Z",
      modified: "2026-05-03T00:00:00.000Z",
      messageCount: 4,
      firstMessage: "first prompt",
    });

    registerH3CodeSession(db, {
      h3codeSessionId: "h3-b",
      repoPath: "/repo",
      providerId: "pi",
      providerSessionRef: "/repo/.pi/sessions/session-b.json",
      created: "2026-05-01T00:00:00.000Z",
      modified: "2026-05-02T00:00:00.000Z",
      messageCount: 1,
      firstMessage: "second",
    });

    const sessions = getIndexedSessions(db);

    assert.equal(sessions.length, 2);
    assert.equal(sessions[0]?.id, "h3-a");
    assert.equal(sessions[0]?.providerSessionRef, "/repo/.pi/sessions/session-a.json");
    assert.equal(sessions[1]?.id, "h3-b");
  } finally {
    db.close();
  }
});

test("getRecentRepos returns recent repositories", () => {
  const db = createPreferencesDatabase();

  try {
    db.prepare(`
      INSERT INTO recent_repos (path, name, added_at, last_opened_at)
      VALUES (?, ?, ?, ?)
    `).run("/repo", "repo", "2026-05-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z");

    const repos = getRecentRepos(db, 10);
    assert.equal(repos.length, 1);
    assert.equal(repos[0]?.path, "/repo");
  } finally {
    db.close();
  }
});
