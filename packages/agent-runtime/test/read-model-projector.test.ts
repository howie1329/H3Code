import assert from "node:assert/strict";
import test from "node:test";
import { ReadModelProjector } from "../src/read-model-projector.js";

test("projects assistant streaming into a read model message", () => {
  const projector = new ReadModelProjector();
  let result = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  result = projector.apply(result.session, { type: "turn.started", sessionId: "s1", providerId: "fake", turnId: "t1", occurredAt: 2 });
  result = projector.apply(result.session, { type: "item.started", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", itemType: "assistant_message", occurredAt: 3 });
  result = projector.apply(result.session, { type: "content.delta", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", stream: "assistant_text", delta: "hi", occurredAt: 4 });

  assert.equal(result.session.messages[0]?.content, "hi");
  assert.equal(result.events[0]?.type, "thread.message.upserted");
});

test("projects pending interactions", () => {
  const projector = new ReadModelProjector();
  const started = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  const result = projector.apply(started.session, { type: "approval.requested", sessionId: "s1", providerId: "fake", requestId: "r1", payload: { command: "x" }, occurredAt: 2 });
  assert.equal(result.session.pendingInteractions[0]?.kind, "approval");
  assert.equal(result.events[0]?.type, "interaction.requested");
});

test("clears active turn when session becomes idle", () => {
  const projector = new ReadModelProjector();
  let result = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  result = projector.apply(result.session, { type: "turn.started", sessionId: "s1", providerId: "fake", turnId: "t1", occurredAt: 2 });
  result = projector.apply(result.session, { type: "session.updated", sessionId: "s1", providerId: "fake", status: "idle", occurredAt: 3 });

  assert.equal(result.session.status, "idle");
  assert.equal(result.session.activeTurnId, undefined);
  assert.equal(result.events[0]?.type, "session.patch");
  if (result.events[0]?.type === "session.patch") assert.equal(result.events[0].patch.activeTurnId, null);
});

test("completes streaming items when session becomes idle", () => {
  const projector = new ReadModelProjector();
  let result = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  result = projector.apply(result.session, { type: "turn.started", sessionId: "s1", providerId: "fake", turnId: "t1", occurredAt: 2 });
  result = projector.apply(result.session, { type: "item.started", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", itemType: "assistant_message", occurredAt: 3 });
  result = projector.apply(result.session, { type: "content.delta", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", stream: "assistant_text", delta: "hi", occurredAt: 4 });
  result = projector.apply(result.session, { type: "tool.updated", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "tool1", toolName: "read", status: "running", occurredAt: 5 });
  result = projector.apply(result.session, { type: "session.updated", sessionId: "s1", providerId: "fake", status: "idle", occurredAt: 6 });

  assert.equal(result.session.messages[0]?.status, "completed");
  assert.equal(result.session.activities[0]?.status, "completed");
  assert.equal(result.events[0]?.type, "session.patch");
  if (result.events[0]?.type === "session.patch") {
    assert.equal(result.events[0].patch.messages?.[0]?.status, "completed");
    assert.equal(result.events[0].patch.activities?.[0]?.status, "completed");
  }
});

test("restores read model messages from session update snapshots", () => {
  const projector = new ReadModelProjector();
  let result = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  result = projector.apply(result.session, {
    type: "session.updated",
    sessionId: "s1",
    providerId: "fake",
    status: "idle",
    messages: [
      { id: "snapshot:0", role: "user", content: "hello", createdAt: 2 },
      { id: "snapshot:1", role: "assistant", content: "hi", updatedAt: 3 },
    ],
    occurredAt: 4,
  });

  assert.equal(result.session.messages.length, 2);
  assert.equal(result.session.messages[0]?.id, "msg:s1:snapshot:0");
  assert.equal(result.session.messages[0]?.role, "user");
  assert.equal(result.session.messages[1]?.content, "hi");
  assert.equal(result.session.messages[1]?.status, "completed");
  assert.equal(result.events[0]?.type, "session.patch");
  if (result.events[0]?.type === "session.patch") assert.equal(result.events[0].patch.messages?.length, 2);
});

test("snapshot messages replace existing live messages without duplicates", () => {
  const projector = new ReadModelProjector();
  let result = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  result = projector.apply(result.session, { type: "turn.started", sessionId: "s1", providerId: "fake", turnId: "t1", occurredAt: 2 });
  result = projector.apply(result.session, { type: "item.started", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", itemType: "assistant_message", occurredAt: 3 });
  result = projector.apply(result.session, { type: "content.delta", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", stream: "assistant_text", delta: "draft", occurredAt: 4 });
  result = projector.apply(result.session, {
    type: "session.updated",
    sessionId: "s1",
    providerId: "fake",
    status: "idle",
    messages: [{ id: "snapshot:assistant", role: "assistant", content: "final" }],
    occurredAt: 5,
  });

  assert.equal(result.session.status, "idle");
  assert.equal(result.session.activeTurnId, undefined);
  assert.equal(result.session.messages.length, 1);
  assert.equal(result.session.messages[0]?.content, "final");
  assert.equal(result.session.messages[0]?.status, "completed");
});

test("session updates without snapshot messages preserve existing messages", () => {
  const projector = new ReadModelProjector();
  let result = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  result = projector.apply(result.session, {
    type: "session.updated",
    sessionId: "s1",
    providerId: "fake",
    status: "idle",
    messages: [{ id: "snapshot:user", role: "user", content: "keep me" }],
    occurredAt: 2,
  });
  result = projector.apply(result.session, {
    type: "session.updated",
    sessionId: "s1",
    providerId: "fake",
    status: "idle",
    occurredAt: 3,
  });

  assert.equal(result.session.messages.length, 1);
  assert.equal(result.session.messages[0]?.content, "keep me");
});

test("completes active items when turn completes with a different turn id", () => {
  const projector = new ReadModelProjector();
  let result = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  result = projector.apply(result.session, { type: "turn.started", sessionId: "s1", providerId: "fake", turnId: "t1", occurredAt: 2 });
  result = projector.apply(result.session, { type: "item.started", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", itemType: "assistant_message", occurredAt: 3 });
  result = projector.apply(result.session, { type: "content.delta", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", stream: "assistant_text", delta: "done", occurredAt: 4 });
  result = projector.apply(result.session, { type: "tool.updated", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "tool1", toolName: "read", status: "pending", occurredAt: 5 });
  result = projector.apply(result.session, { type: "turn.completed", sessionId: "s1", providerId: "fake", turnId: "t2", status: "completed", occurredAt: 6 });

  assert.equal(result.session.status, "idle");
  assert.equal(result.session.messages[0]?.status, "completed");
  assert.equal(result.session.activities[0]?.status, "completed");
});

test("completes active items when session ends", () => {
  const projector = new ReadModelProjector();
  let result = projector.apply(undefined, { type: "session.started", sessionId: "s1", providerId: "fake", repoPath: "/repo", occurredAt: 1 });
  result = projector.apply(result.session, { type: "turn.started", sessionId: "s1", providerId: "fake", turnId: "t1", occurredAt: 2 });
  result = projector.apply(result.session, { type: "item.started", sessionId: "s1", providerId: "fake", turnId: "t1", itemId: "i1", itemType: "assistant_message", occurredAt: 3 });
  result = projector.apply(result.session, { type: "session.ended", sessionId: "s1", providerId: "fake", status: "completed", occurredAt: 4 });

  assert.equal(result.session.status, "idle");
  assert.equal(result.session.messages[0]?.status, "completed");
});

test("rejects events for unknown sessions", () => {
  const projector = new ReadModelProjector();
  assert.throws(
    () => projector.apply(undefined, { type: "approval.requested", sessionId: "s1", providerId: "fake", requestId: "r1", payload: { command: "x" }, occurredAt: 1 }),
    /cannot be applied before session start/,
  );
});
