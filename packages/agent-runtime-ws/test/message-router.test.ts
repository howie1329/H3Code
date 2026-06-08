import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_PROTOCOL_VERSION, type ServerToClientMessage, type UiSessionEvent } from "@h3code/agent-protocol";
import { AgentRuntimeWsMessageRouter, type RuntimeWsPeer } from "../src/message-router.js";

class FakeRuntime {
  listener?: (event: UiSessionEvent) => void;
  dispatched: unknown[] = [];
  async dispatchCommand(command: unknown) { this.dispatched.push(command); }
  getSnapshot(sessionId: string) { return { id: sessionId, providerId: "fake", repoPath: "/repo", status: "idle", messages: [], activities: [], pendingInteractions: [], updatedAt: 1 }; }
  subscribe(_sessionId: string, listener: (event: UiSessionEvent) => void) { this.listener = listener; return () => { this.listener = undefined; }; }
}

class Peer implements RuntimeWsPeer {
  messages: ServerToClientMessage[] = [];
  send(message: ServerToClientMessage): void { this.messages.push(message); }
}

test("routes commands to runtime", async () => {
  const runtime = new FakeRuntime();
  const router = new AgentRuntimeWsMessageRouter(runtime as never);
  await router.route(new Peer(), { type: "command", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { type: "turn.send", sessionId: "s1", input: { text: "x" } } });
  assert.equal(runtime.dispatched.length, 1);
});

test("responds to snapshot requests", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const router = new AgentRuntimeWsMessageRouter(runtime as never);
  await router.route(peer, { type: "session.snapshot.request", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { sessionId: "s1" } });
  assert.equal(peer.messages[0]?.type, "session.snapshot.response");
});

test("forwards subscribed session events", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const router = new AgentRuntimeWsMessageRouter(runtime as never);
  await router.route(peer, { type: "session.subscribe", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { sessionId: "s1" } });
  runtime.listener?.({ type: "session.patch", sessionId: "s1", patch: { status: "running", updatedAt: 2 } });
  assert.equal(peer.messages[0]?.type, "session.event");
});

test("responds with an error for unsupported message types", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const router = new AgentRuntimeWsMessageRouter(runtime as never);
  await router.route(peer, { type: "nope", protocolVersion: AGENT_PROTOCOL_VERSION, payload: {} } as never);

  assert.equal(peer.messages[0]?.type, "error");
  assert.equal(peer.messages[0]?.payload.code, "unsupported_message");
});
