import assert from "node:assert/strict";
import test from "node:test";

import { piRpcToDomainEvents } from "./adapter.js";
import { applySessionEvent, createInitialSessionReadModel, hydrateFromSnapshot } from "./projector.js";
import { composerPhase, statusStripLines, transcriptMessages } from "./selectors.js";

test("maps all 16 PI RPC events to domain events", () => {
  const fixtures: Array<{ type: string; payload?: Record<string, unknown> }> = [
    { type: "agent_start" },
    { type: "agent_end", payload: { messages: [{ id: "m1", role: "assistant", content: "done" }] } },
    { type: "turn_start" },
    { type: "turn_end", payload: { message: { id: "m2", role: "assistant", content: "turn" }, toolResults: [{ id: "tr1", role: "toolResult" }] } },
    { type: "message_start", payload: { message: { id: "s1", role: "assistant", content: "" } } },
    {
      type: "message_update",
      payload: {
        assistantMessageEvent: { type: "text", partial: { id: "s1", role: "assistant", content: "Hello" } },
      },
    },
    { type: "message_end", payload: { message: { id: "s1", role: "assistant", content: "Hello world" } } },
    {
      type: "tool_execution_start",
      payload: { toolCallId: "t1", toolName: "read", args: { path: "a.ts" } },
    },
    {
      type: "tool_execution_update",
      payload: { toolCallId: "t1", toolName: "read", partialResult: { content: [{ type: "text", text: "partial" }] } },
    },
    {
      type: "tool_execution_end",
      payload: { toolCallId: "t1", toolName: "read", result: { content: [{ type: "text", text: "final" }] } },
    },
    { type: "queue_update", payload: { steering: ["fix tests"], followUp: ["and lint"] } },
    { type: "compaction_start", payload: { reason: "context limit" } },
    { type: "compaction_end", payload: { reason: "context limit" } },
    { type: "auto_retry_start", payload: { attempt: 2, maxAttempts: 3, delayMs: 1500 } },
    { type: "auto_retry_end", payload: { attempt: 2, success: true } },
    { type: "extension_error", payload: { error: "boom", extensionPath: "/tmp/ext.ts", event: "session_start" } },
  ];

  for (const fixture of fixtures) {
    const events = piRpcToDomainEvents({ type: fixture.type, ...fixture.payload });
    assert.ok(events.length > 0, `expected domain event for ${fixture.type}`);
  }
});

test("maps extension fire-and-forget UI requests", () => {
  const extensionFixtures = [
    { method: "setStatus", statusKey: "indexer", statusText: "Scanning…" },
    { method: "notify", message: "Saved", notifyType: "info" },
    { method: "setWidget", widgetKey: "footer", widgetLines: ["line 1", "line 2"] },
    { method: "setTitle", title: "H3 workspace" },
  ];

  for (const fixture of extensionFixtures) {
    const events = piRpcToDomainEvents({ type: "extension_ui_request", ...fixture });
    assert.ok(events.length > 0, `expected domain event for ${fixture.method}`);
  }
});

test("projector commits turn before run end and tracks live tool output", () => {
  let model = createInitialSessionReadModel();

  model = applySessionEvent(model, piRpcToDomainEvents({ type: "agent_start" })[0]!);
  model = applySessionEvent(
    model,
    piRpcToDomainEvents({
      type: "tool_execution_start",
      toolCallId: "tool-1",
      toolName: "bash",
      args: { command: "npm test" },
    })[0]!,
  );
  model = applySessionEvent(
    model,
    piRpcToDomainEvents({
      type: "tool_execution_update",
      toolCallId: "tool-1",
      toolName: "bash",
      partialResult: { content: [{ type: "text", text: "running" }] },
    })[0]!,
  );

  assert.equal(Object.keys(model.tools).length, 1);
  assert.match(composerPhase(model)?.text ?? "", /bash/i);

  model = applySessionEvent(
    model,
    piRpcToDomainEvents({
      type: "turn_end",
      message: { id: "assistant-1", role: "assistant", content: "Finished" },
      toolResults: [{ id: "result-1", role: "toolResult", toolCallId: "tool-1" }],
    })[0]!,
  );

  assert.equal(model.messages.length, 2);
  assert.equal(model.needsDiffRefresh, true);
  assert.equal(Object.keys(model.tools).length, 0);

  model = applySessionEvent(
    model,
    piRpcToDomainEvents({
      type: "agent_end",
      messages: [
        { id: "user-1", role: "user", content: "hi" },
        { id: "assistant-1", role: "assistant", content: "Finished" },
        { id: "result-1", role: "toolResult", toolCallId: "tool-1" },
      ],
    })[0]!,
  );

  assert.equal(model.isAgentRunning, false);
  assert.equal(model.needsRunHousekeeping, true);
  assert.equal(model.messages.length, 3);
});

test("run.failed unlocks the read model and preserves error", () => {
  let model = createInitialSessionReadModel();

  model = applySessionEvent(model, { type: "run.started", occurredAt: 1 });
  model = applySessionEvent(model, {
    type: "message.streaming",
    phase: "update",
    message: { role: "assistant", content: "partial" },
    occurredAt: 2,
  });
  model = applySessionEvent(model, { type: "run.failed", errorMessage: "model failed", occurredAt: 3 });

  assert.equal(model.isAgentRunning, false);
  assert.equal(model.phase, "idle");
  assert.equal(model.streamingMessage, null);
  assert.equal(model.streamingError, "model failed");
  assert.equal(Object.keys(model.tools).length, 0);
  assert.equal(model.needsRunHousekeeping, true);
});

test("deduplicates id-less assistant message_end and turn_end", () => {
  let model = createInitialSessionReadModel();

  model = applySessionEvent(
    model,
    piRpcToDomainEvents({
      type: "message_end",
      message: { role: "assistant", content: "Finished without an id" },
    })[0]!,
  );
  model = applySessionEvent(
    model,
    piRpcToDomainEvents({
      type: "turn_end",
      message: { role: "assistant", content: "Finished without an id" },
    })[0]!,
  );

  assert.equal(model.messages.length, 1);
  assert.deepEqual(model.messages[0], { role: "assistant", content: "Finished without an id" });
});

test("hydrates snapshot and surfaces queue, compaction, retry, and status strip", () => {
  let model = createInitialSessionReadModel();

  model = hydrateFromSnapshot(model, { isStreaming: false, isCompacting: false }, [
    { id: "u1", role: "user", content: "hello" },
  ]);

  model = applySessionEvent(
    model,
    piRpcToDomainEvents({ type: "queue_update", steering: ["a"], followUp: ["b", "c"] })[0]!,
  );
  model = applySessionEvent(model, piRpcToDomainEvents({ type: "compaction_start", reason: "limit" })[0]!);
  assert.match(composerPhase(model)?.text ?? "", /Compacting context/i);

  model = applySessionEvent(
    model,
    piRpcToDomainEvents({ type: "auto_retry_start", attempt: 1, maxAttempts: 3, delayMs: 2000 })[0]!,
  );
  model = applySessionEvent(
    model,
    piRpcToDomainEvents({
      type: "extension_ui_request",
      method: "setStatus",
      statusKey: "sync",
      statusText: "Indexing",
    })[0]!,
  );

  model = applySessionEvent(model, piRpcToDomainEvents({ type: "compaction_end" })[0]!);
  assert.match(composerPhase(model)?.text ?? "", /Retry 1\/3/);
  assert.ok(statusStripLines(model).some((line) => line.includes("sync: Indexing")));

  model = applySessionEvent(model, piRpcToDomainEvents({ type: "auto_retry_end", success: true })[0]!);

  const transcript = transcriptMessages(model);
  assert.equal(transcript.length, 1);
});
