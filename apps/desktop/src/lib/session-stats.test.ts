import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SessionSnapshot } from "@h3code/agent-core";

import { parseSessionStats, sessionRefToId } from "./session-stats.js";

describe("session-stats", () => {
  it("derives a session id from the session ref", () => {
    assert.equal(sessionRefToId("/tmp/project/session-abc.jsonl"), "session-abc");
  });

  it("parses stats from a session snapshot", () => {
    const snapshot: SessionSnapshot = {
      summary: {
        providerId: "pi",
        sessionRef: "/tmp/session.jsonl",
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
      stats: {
        userMessages: 2,
        assistantMessages: 3,
        toolCalls: 1,
        toolResults: 1,
        totalMessages: 5,
        tokens: {
          input: 10,
          output: 20,
          cacheRead: 0,
          cacheWrite: 0,
          total: 30,
        },
        cost: 0.01,
      },
    };

    const stats = parseSessionStats(snapshot);

    assert.ok(stats);
    assert.equal(stats.totalMessages, 5);
    assert.equal(stats.tokens.total, 30);
  });
});
