import assert from "node:assert/strict";
import test from "node:test";
import { createPiRuntimeEventMapperState, mapPiEventToRuntimeEvents } from "../src/event-mapper.js";

test("maps PI streaming message events to runtime item and delta events", () => {
  const state = createPiRuntimeEventMapperState();
  const context = { sessionId: "s1", providerId: "pi", state };

  const [turn] = mapPiEventToRuntimeEvents({ type: "turn.started", occurredAt: 1 }, context);
  assert.equal(turn.type, "turn.started");

  const [item] = mapPiEventToRuntimeEvents({ type: "message.streaming", phase: "start", occurredAt: 2 }, context);
  assert.equal(item.type, "item.started");
  assert.equal(item.turnId, turn.type === "turn.started" ? turn.turnId : undefined);

  const [delta] = mapPiEventToRuntimeEvents({ type: "message.streaming", phase: "update", message: "hello", occurredAt: 3 }, context);
  assert.equal(delta.type, "content.delta");
  assert.equal(delta.delta, "hello");
  assert.equal(delta.stream, "assistant_text");
});

test("extracts text from structured PI message objects", () => {
  const [delta] = mapPiEventToRuntimeEvents(
    { type: "message.streaming", phase: "update", message: { content: [{ type: "text", text: "hello" }] }, occurredAt: 1 },
    { sessionId: "s1" },
  );

  assert.equal(delta.type, "content.delta");
  assert.equal(delta.delta, "hello");
});

test("does not stringify unknown message objects", () => {
  const events = mapPiEventToRuntimeEvents(
    { type: "message.streaming", phase: "update", message: { type: "metadata", value: { nested: true } }, occurredAt: 1 },
    { sessionId: "s1" },
  );

  assert.deepEqual(events, []);
});

test("does not emit duplicate turn starts for run and turn start pair", () => {
  const state = createPiRuntimeEventMapperState();
  const context = { sessionId: "s1", providerId: "pi", state };

  const [runStarted] = mapPiEventToRuntimeEvents({ type: "run.started", occurredAt: 1 }, context);
  const duplicateTurnStart = mapPiEventToRuntimeEvents({ type: "turn.started", occurredAt: 2 }, context);

  assert.equal(runStarted.type, "turn.started");
  assert.deepEqual(duplicateTurnStart, []);
});

test("maps PI tool events to runtime tool updates", () => {
  const [event] = mapPiEventToRuntimeEvents(
    { type: "tool.updated", phase: "end", toolCallId: "abc", toolName: "read", content: "ok", occurredAt: 1 },
    { sessionId: "s1" },
  );

  assert.equal(event.type, "tool.updated");
  assert.equal(event.itemId, "tool-abc");
  assert.equal(event.status, "completed");
});

test("maps confirm UI requests to approval requests", () => {
  const [event] = mapPiEventToRuntimeEvents(
    { type: "extension.ui.request", request: { id: "r1", kind: "confirm", title: "Approve?" }, occurredAt: 1 },
    { sessionId: "s1" },
  );

  assert.equal(event.type, "approval.requested");
  assert.equal(event.requestId, "r1");
});
