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

test("multiple PI text deltas accumulate without repeated partials", () => {
  const state = createPiRuntimeEventMapperState();
  const context = { sessionId: "s1", providerId: "pi", state };

  mapPiEventToRuntimeEvents({ type: "turn.started", occurredAt: 1 }, context);
  mapPiEventToRuntimeEvents({ type: "message.streaming", phase: "start", occurredAt: 2 }, context);
  const [hello] = mapPiEventToRuntimeEvents(
    { type: "message.streaming", phase: "update", message: "Hello", occurredAt: 3 },
    context,
  );
  const [world] = mapPiEventToRuntimeEvents(
    { type: "message.streaming", phase: "update", message: " world", occurredAt: 4 },
    context,
  );

  assert.equal(hello.type, "content.delta");
  assert.equal(world.type, "content.delta");
  assert.equal(`${hello.delta}${world.delta}`, "Hello world");
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

test("maps PI snapshot messages to runtime snapshot messages", () => {
  const [event] = mapPiEventToRuntimeEvents(
    {
      type: "session.changed",
      snapshot: {
        cwd: "/repo",
        sessionFile: "/tmp/session.jsonl",
        sessionId: "pi-session",
        messages: [
          { id: "u1", role: "user", content: "hello", createdAt: 10 },
          { id: "a1", role: "assistant", content: [{ type: "text", text: "hi" }], updatedAt: 20 },
        ],
        isStreaming: false,
        isCompacting: false,
        steering: [],
        followUp: [],
        activeTools: [],
        tools: [],
        diagnostics: [],
      },
      occurredAt: 30,
    },
    { sessionId: "s1", providerId: "pi", includeSnapshotMessages: true },
  );

  assert.equal(event.type, "session.updated");
  assert.deepEqual(event.messages?.map((message) => [message.id, message.role, message.content]), [
    ["snapshot:s1:u1", "user", "hello"],
    ["snapshot:s1:a1", "assistant", "hi"],
  ]);
});

test("ignores PI snapshot messages without renderable role and text", () => {
  const [event] = mapPiEventToRuntimeEvents(
    {
      type: "session.changed",
      snapshot: {
        cwd: "/repo",
        sessionFile: undefined,
        sessionId: "pi-session",
        messages: [
          { type: "metadata", value: { nested: true } },
          { role: "assistant", content: { type: "metadata", value: true } },
          { role: "tool", content: "tool output" },
        ],
        isStreaming: false,
        isCompacting: false,
        steering: [],
        followUp: [],
        activeTools: [],
        tools: [],
        diagnostics: [],
      },
      occurredAt: 1,
    },
    { sessionId: "s1", includeSnapshotMessages: true },
  );

  assert.equal(event.type, "session.updated");
  assert.deepEqual(event.messages, []);
});

test("omits PI snapshot messages unless requested", () => {
  const [event] = mapPiEventToRuntimeEvents(
    {
      type: "session.changed",
      snapshot: {
        cwd: "/repo",
        sessionFile: "/tmp/session.jsonl",
        sessionId: "pi-session",
        messages: [{ id: "u1", role: "user", content: "hello" }],
        isStreaming: false,
        isCompacting: false,
        steering: [],
        followUp: [],
        activeTools: [],
        tools: [],
        diagnostics: [],
      },
      occurredAt: 1,
    },
    { sessionId: "s1" },
  );

  assert.equal(event.type, "session.updated");
  assert.equal(event.messages, undefined);
});
