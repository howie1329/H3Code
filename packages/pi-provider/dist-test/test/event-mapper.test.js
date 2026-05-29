import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPiSessionEvent } from "../src/index.js";
test("maps core Pi lifecycle events to provider events", () => {
    assert.deepEqual(mapPiSessionEvent({ type: "agent_start" }, 1), [{ type: "run.started", occurredAt: 1 }]);
    assert.deepEqual(mapPiSessionEvent({ type: "turn_start" }, 2), [{ type: "turn.started", occurredAt: 2 }]);
    assert.deepEqual(mapPiSessionEvent({ type: "agent_end", messages: ["done"], willRetry: false }, 3), [
        { type: "run.ended", messages: ["done"], willRetry: false, occurredAt: 3 },
    ]);
});
test("maps message streaming events without losing Pi message payloads", () => {
    const message = { id: "assistant-1", role: "assistant", content: [{ type: "text", text: "hi" }] };
    assert.deepEqual(mapPiSessionEvent({ type: "message_start", message }, 1), [
        { type: "message.streaming", phase: "start", message, occurredAt: 1 },
    ]);
    assert.deepEqual(mapPiSessionEvent({
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", partial: message },
    }, 2), [
        {
            type: "message.streaming",
            phase: "update",
            message,
            deltaType: "text_delta",
            errorMessage: undefined,
            occurredAt: 2,
        },
    ]);
    assert.deepEqual(mapPiSessionEvent({ type: "message_end", message }, 3), [
        { type: "message.streaming", phase: "end", message, occurredAt: 3 },
    ]);
});
test("maps tool, queue, compaction, retry, and extension events", () => {
    assert.deepEqual(mapPiSessionEvent({ type: "tool_execution_end", toolCallId: "tool-1", toolName: "read", result: { content: ["ok"] } }, 1), [
        {
            type: "tool.updated",
            phase: "end",
            toolCallId: "tool-1",
            toolName: "read",
            args: undefined,
            content: ["ok"],
            isError: false,
            errorText: undefined,
            occurredAt: 1,
        },
    ]);
    assert.deepEqual(mapPiSessionEvent({ type: "queue_update", steering: ["a"], followUp: ["b"] }, 2), [
        { type: "queue.updated", steering: ["a"], followUp: ["b"], occurredAt: 2 },
    ]);
    assert.deepEqual(mapPiSessionEvent({ type: "compaction_start", reason: "manual" }, 3), [
        { type: "compaction.updated", phase: "start", reason: "manual", occurredAt: 3 },
    ]);
    assert.deepEqual(mapPiSessionEvent({ type: "auto_retry_start", attempt: 1, maxAttempts: 3, delayMs: 500 }, 4), [
        {
            type: "retry.updated",
            phase: "start",
            attempt: 1,
            maxAttempts: 3,
            delayMs: 500,
            errorMessage: undefined,
            occurredAt: 4,
        },
    ]);
    assert.deepEqual(mapPiSessionEvent({ type: "extension_error", error: { message: "extension failed" }, extensionPath: "/x" }, 5), [
        {
            type: "extension.error",
            message: "extension failed",
            extensionPath: "/x",
            event: undefined,
            occurredAt: 5,
        },
    ]);
});
//# sourceMappingURL=event-mapper.test.js.map