import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SessionReadModel } from "@h3code/agent-protocol";

import { parseSessionStats, sessionRefToId } from "./session-stats.js";

describe("session-stats", () => {
  it("derives a session id from the session ref", () => {
    assert.equal(sessionRefToId("/tmp/project/session-abc.jsonl"), "session-abc");
  });

  it("parses stats from a session read model", () => {
    const session: SessionReadModel = {
      id: "s1",
      providerId: "pi",
      repoPath: "/tmp",
      status: "idle",
      messages: [
        { id: "m1", sessionId: "s1", role: "user", content: "hi", createdAt: 1, updatedAt: 1 },
        { id: "m2", sessionId: "s1", role: "assistant", content: "hello", createdAt: 2, updatedAt: 2 },
        { id: "m3", sessionId: "s1", role: "assistant", content: "more", createdAt: 3, updatedAt: 3 },
      ],
      activities: [
        {
          id: "a1",
          sessionId: "s1",
          kind: "tool",
          status: "completed",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      pendingInteractions: [],
      updatedAt: 1,
    };

    const stats = parseSessionStats(session);

    assert.ok(stats);
    assert.equal(stats.totalMessages, 3);
    assert.equal(stats.userMessages, 1);
    assert.equal(stats.assistantMessages, 2);
    assert.equal(stats.toolCalls, 1);
  });
});
