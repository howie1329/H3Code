import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { clearSessionMessageCaches, evictSessionMessageCaches, getSessionMessageCache, hashContent, migrateSessionMessageCacheSchema, upsertSessionMessageCache, } from "../src/session-message-cache.js";
function createCacheDatabase() {
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
    migrateSessionMessageCacheSchema(db);
    db.prepare(`
    INSERT INTO recent_repos (path, name, added_at, last_opened_at)
    VALUES (?, ?, ?, ?)
  `).run("/repo", "repo", "2026-06-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z");
    return db;
}
test("upsert and get round-trip session message cache", () => {
    const db = createCacheDatabase();
    try {
        upsertSessionMessageCache(db, {
            sessionPath: "/repo/.pi/sessions/a.jsonl",
            repoPath: "/repo",
            messages: [{ role: "user", content: "hello" }],
            sessionState: { isStreaming: false, isCompacting: false, sessionFile: "/repo/.pi/sessions/a.jsonl" },
            lastOpenedAt: "2026-06-01T00:00:00.000Z",
        });
        const entry = getSessionMessageCache(db, "/repo/.pi/sessions/a.jsonl");
        assert.ok(entry);
        assert.equal(entry.messageCount, 1);
        assert.equal(entry.messages.length, 1);
        assert.equal(entry.syncStatus, "fresh");
        assert.equal(entry.contentHash, hashContent(JSON.stringify([{ role: "user", content: "hello" }])));
    }
    finally {
        db.close();
    }
});
test("evictSessionMessageCaches keeps most recently opened sessions", () => {
    const db = createCacheDatabase();
    try {
        for (let index = 0; index < 5; index += 1) {
            upsertSessionMessageCache(db, {
                sessionPath: `/repo/.pi/sessions/${index}.jsonl`,
                repoPath: "/repo",
                messages: [{ index }],
                lastOpenedAt: `2026-06-01T00:00:0${index}.000Z`,
            });
        }
        evictSessionMessageCaches(db, 3);
        const remaining = db.prepare("SELECT session_path AS path FROM session_message_cache ORDER BY path").all();
        assert.equal(remaining.length, 3);
        assert.deepEqual(remaining.map((row) => row.path), ["/repo/.pi/sessions/2.jsonl", "/repo/.pi/sessions/3.jsonl", "/repo/.pi/sessions/4.jsonl"]);
    }
    finally {
        db.close();
    }
});
test("clearSessionMessageCaches removes all rows", () => {
    const db = createCacheDatabase();
    try {
        upsertSessionMessageCache(db, {
            sessionPath: "/repo/.pi/sessions/a.jsonl",
            repoPath: "/repo",
            messages: [],
            lastOpenedAt: "2026-06-01T00:00:00.000Z",
        });
        clearSessionMessageCaches(db);
        assert.equal(getSessionMessageCache(db, "/repo/.pi/sessions/a.jsonl"), undefined);
    }
    finally {
        db.close();
    }
});
//# sourceMappingURL=session-message-cache.test.js.map