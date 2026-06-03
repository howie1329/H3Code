import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptySessionReadModel } from "$lib/pi-session/read-model.js";
import { deleteCachedSession, getCachedSession, setCachedSession, SESSION_CACHE_MAX_SIZE, } from "./session-cache.js";
function makeEntry(sessionPath, lastAccessedAt) {
    return {
        sessionPath,
        sessionReadModel: createEmptySessionReadModel(),
        sessionState: {
            thinkingLevel: "off",
            isStreaming: false,
            isCompacting: false,
            steeringMode: "one-at-a-time",
            followUpMode: "one-at-a-time",
            sessionFile: sessionPath,
            sessionId: sessionPath,
            autoCompactionEnabled: true,
            messageCount: 0,
            pendingMessageCount: 0,
        },
        lastAccessedAt,
    };
}
describe("session-cache", () => {
    it("stores and returns cloned cache entries", () => {
        let cache = setCachedSession({}, makeEntry("/tmp/a.jsonl", 1));
        const cached = getCachedSession(cache, "/tmp/a.jsonl");
        assert.ok(cached);
        assert.equal(cached.sessionPath, "/tmp/a.jsonl");
        assert.notEqual(cached.sessionReadModel, cache["/tmp/a.jsonl"].sessionReadModel);
    });
    it("deletes cache entries", () => {
        let cache = setCachedSession({}, makeEntry("/tmp/a.jsonl", 1));
        cache = deleteCachedSession(cache, "/tmp/a.jsonl");
        assert.equal(getCachedSession(cache, "/tmp/a.jsonl"), undefined);
    });
    it("evicts the least recently accessed entry when over capacity", () => {
        let cache = {};
        for (let index = 0; index < SESSION_CACHE_MAX_SIZE; index += 1) {
            cache = setCachedSession(cache, makeEntry(`/tmp/${index}.jsonl`, index));
        }
        cache = setCachedSession(cache, makeEntry("/tmp/new.jsonl", SESSION_CACHE_MAX_SIZE + 1));
        assert.equal(getCachedSession(cache, "/tmp/0.jsonl"), undefined);
        assert.ok(getCachedSession(cache, "/tmp/new.jsonl"));
        assert.ok(getCachedSession(cache, `/tmp/${SESSION_CACHE_MAX_SIZE - 1}.jsonl`));
    });
});
//# sourceMappingURL=session-cache.test.js.map