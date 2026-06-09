import type { SessionReadModel, UiMessage, UiSessionEvent } from "@h3code/agent-protocol";
import assert from "node:assert/strict";
import test from "node:test";

import { applySessionEvent, createEmptySessionReadModel } from "./session-state.js";

const baseSession: SessionReadModel = {
  id: "s1",
  providerId: "pi",
  repoPath: "/repo",
  status: "idle",
  messages: [],
  activities: [],
  pendingInteractions: [],
  updatedAt: 1,
};

test("applySessionEvent replaces snapshot", () => {
  const next = applySessionEvent(baseSession, {
    type: "session.snapshot",
    session: { ...baseSession, status: "running", updatedAt: 2 },
  });

  assert.equal(next.status, "running");
});

test("applySessionEvent merges patch and clears nullable fields", () => {
  const current: SessionReadModel = {
    ...baseSession,
    activeTurnId: "t1",
    title: "Old",
  };

  const next = applySessionEvent(current, {
    type: "session.patch",
    sessionId: "s1",
    patch: { activeTurnId: null, title: null, updatedAt: 3 },
  });

  assert.equal(next.activeTurnId, undefined);
  assert.equal(next.title, undefined);
});

test("applySessionEvent upserts messages and activities", () => {
  const message: UiMessage = {
    id: "m1",
    sessionId: "s1",
    role: "user",
    content: "hello",
    createdAt: 1,
    updatedAt: 1,
  };

  const events: UiSessionEvent[] = [
    { type: "thread.message.upserted", sessionId: "s1", message },
    {
      type: "thread.message.upserted",
      sessionId: "s1",
      message: { ...message, content: "hello again", updatedAt: 2 },
    },
  ];

  const next = events.reduce((model, event) => applySessionEvent(model, event), createEmptySessionReadModel());

  assert.equal(next.messages.length, 1);
  assert.equal(next.messages[0]?.content, "hello again");
});

test("applySessionEvent handles interaction lifecycle", () => {
  const requested = applySessionEvent(baseSession, {
    type: "interaction.requested",
    sessionId: "s1",
    request: {
      id: "r1",
      sessionId: "s1",
      kind: "approval",
      payload: { id: "r1", kind: "confirm", title: "Approve?" },
      createdAt: 1,
    },
  });

  assert.equal(requested.pendingInteractions.length, 1);

  const resolved = applySessionEvent(requested, {
    type: "interaction.resolved",
    sessionId: "s1",
    requestId: "r1",
  });

  assert.equal(resolved.pendingInteractions.length, 0);
});
