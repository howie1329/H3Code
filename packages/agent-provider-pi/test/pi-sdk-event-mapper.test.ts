import assert from "node:assert/strict";
import test from "node:test";
import { mapPiSessionEvent } from "../src/pi-sdk/event-mapper.js";

test("message_update text deltas ignore full partial message payloads", () => {
  const [event] = mapPiSessionEvent(
    {
      type: "message_update",
      message: "Hello world",
      assistantMessageEvent: {
        type: "text_delta",
        delta: " world",
        partial: "Hello world",
        message: "Hello world",
      },
    },
    1,
  );

  assert.deepEqual(event, {
    type: "message.streaming",
    phase: "update",
    message: " world",
    deltaType: "text_delta",
    errorMessage: undefined,
    occurredAt: 1,
  });
});

test("message_update errors remain recoverable streaming errors", () => {
  const [event] = mapPiSessionEvent(
    {
      type: "message_update",
      assistantMessageEvent: {
        type: "error",
        error: new Error("boom"),
      },
    },
    2,
  );

  assert.equal(event.type, "message.streaming");
  assert.equal(event.phase, "update");
  assert.equal(event.message, undefined);
  assert.equal(event.deltaType, "error");
  assert.equal(event.errorMessage, "boom");
});
