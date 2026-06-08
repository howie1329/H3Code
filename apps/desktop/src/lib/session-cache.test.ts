import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SessionSnapshot } from "@h3code/agent-core";

import { createEmptySessionReadModel } from "./pi-session/read-model.js";
import {
  deleteCachedSession,
  getCachedSession,
  setCachedSession,
  SESSION_CACHE_MAX_SIZE,
  type SessionCacheEntry,
} from "./session-cache.js";

function makeSnapshot(sessionRef: string): SessionSnapshot {
  return {
    summary: {
      providerId: "pi",
      sessionRef,
      status: "idle",
    },
    cwd: "/tmp",
    messages: [],
    isStreaming: false,
    isCompacting: false,
    steering: [],
    followUp: [],
    activeTools: [],
    tools: [],
    diagnostics: [],
  };
}

function makeEntry(sessionRef: string, lastAccessedAt: number): SessionCacheEntry {
  return {
    sessionRef,
    sessionReadModel: createEmptySessionReadModel(),
    sessionSnapshot: makeSnapshot(sessionRef),
    lastAccessedAt,
  };
}

describe("session-cache", () => {
  it("stores and returns cloned cache entries", () => {
    let cache = setCachedSession({}, makeEntry("/tmp/a.jsonl", 1));

    const cached = getCachedSession(cache, "/tmp/a.jsonl");

    assert.ok(cached);
    assert.equal(cached.sessionRef, "/tmp/a.jsonl");
    assert.notEqual(cached.sessionReadModel, cache["/tmp/a.jsonl"]!.sessionReadModel);
  });

  it("deletes cache entries", () => {
    let cache = setCachedSession({}, makeEntry("/tmp/a.jsonl", 1));
    cache = deleteCachedSession(cache, "/tmp/a.jsonl");

    assert.equal(getCachedSession(cache, "/tmp/a.jsonl"), undefined);
  });

  it("evicts the least recently accessed entry when over capacity", () => {
    let cache: Record<string, SessionCacheEntry> = {};

    for (let index = 0; index < SESSION_CACHE_MAX_SIZE; index += 1) {
      cache = setCachedSession(cache, makeEntry(`/tmp/${index}.jsonl`, index));
    }

    cache = setCachedSession(cache, makeEntry("/tmp/new.jsonl", SESSION_CACHE_MAX_SIZE + 1));

    assert.equal(getCachedSession(cache, "/tmp/0.jsonl"), undefined);
    assert.ok(getCachedSession(cache, "/tmp/new.jsonl"));
    assert.ok(getCachedSession(cache, `/tmp/${SESSION_CACHE_MAX_SIZE - 1}.jsonl`));
  });
});
