import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sessionSummaryToPiSessionSummary, snapshotToPiSessionState } from "./agent-adapters.js";

describe("agent-adapters", () => {
  it("maps session summaries for the sidebar", () => {
    const summary = sessionSummaryToPiSessionSummary({
      providerId: "pi",
      sessionRef: "/tmp/repo/.pi/sessions/demo.jsonl",
      status: "idle",
      title: "Demo",
      preview: "Hello",
      repoPath: "/tmp/repo",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
      messageCount: 3,
    });

    assert.equal(summary.path, "/tmp/repo/.pi/sessions/demo.jsonl");
    assert.equal(summary.id, "demo");
    assert.equal(summary.firstMessage, "Hello");
    assert.equal(summary.messageCount, 3);
  });

  it("maps snapshots into Pi session state", () => {
    const state = snapshotToPiSessionState({
      summary: {
        providerId: "pi",
        sessionRef: "/tmp/repo/.pi/sessions/demo.jsonl",
        status: "idle",
      },
      cwd: "/tmp/repo",
      messages: [{ role: "user" }],
      isStreaming: true,
      isCompacting: false,
      steering: [],
      followUp: [],
      activeTools: [],
      tools: [],
      diagnostics: [],
      thinkingLevel: "low",
    });

    assert.equal(state.sessionFile, "/tmp/repo/.pi/sessions/demo.jsonl");
    assert.equal(state.isStreaming, true);
    assert.equal(state.thinkingLevel, "low");
    assert.equal(state.messageCount, 1);
  });
});
