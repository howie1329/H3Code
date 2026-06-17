import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  getHarnessResumeBlob,
  getSessionUiMessages,
  migrateSessionCacheSchema,
  saveHarnessResumeBlob,
  saveSessionUiMessages,
} from "../src/session-cache.js";
import { migrateRegisteredSessionsSchema, registerH3CodeSession, removeRegisteredSession } from "../src/session-registry.js";

function createCacheDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

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

  migrateRegisteredSessionsSchema(db);
  migrateSessionCacheSchema(db);

  db.prepare(`
    INSERT INTO recent_repos (path, name, added_at, last_opened_at)
    VALUES (?, ?, ?, ?)
  `).run("/repo", "repo", "2026-05-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z");

  registerH3CodeSession(db, {
    h3codeSessionId: "h3-session-1",
    repoPath: "/repo",
    providerId: "harness-pi",
    providerSessionRef: "h3-session-1",
    created: "2026-05-01T00:00:00.000Z",
    modified: "2026-05-01T00:00:00.000Z",
    messageCount: 0,
    firstMessage: "",
  });

  return db;
}

test("saveSessionUiMessages round-trips display cache rows", () => {
  const db = createCacheDatabase();

  try {
    const messages = [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "Hi" }] },
    ];

    saveSessionUiMessages(db, "h3-session-1", messages);

    assert.deepEqual(getSessionUiMessages(db, "h3-session-1"), messages);
  } finally {
    db.close();
  }
});

test("saveHarnessResumeBlob round-trips opaque resume state", () => {
  const db = createCacheDatabase();

  try {
    const blob = { version: 1, state: { turns: 2 } };

    saveHarnessResumeBlob(db, "h3-session-1", blob);

    assert.deepEqual(getHarnessResumeBlob(db, "h3-session-1"), blob);
  } finally {
    db.close();
  }
});

test("removeRegisteredSession cascades cache tables", () => {
  const db = createCacheDatabase();

  try {
    saveSessionUiMessages(db, "h3-session-1", [{ id: "m1", role: "user", parts: [] }]);
    saveHarnessResumeBlob(db, "h3-session-1", { ok: true });

    removeRegisteredSession(db, "h3-session-1");

    assert.equal(getSessionUiMessages(db, "h3-session-1"), undefined);
    assert.equal(getHarnessResumeBlob(db, "h3-session-1"), undefined);
  } finally {
    db.close();
  }
});
