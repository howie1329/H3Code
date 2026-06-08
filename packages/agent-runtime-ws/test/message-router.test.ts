import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_PROTOCOL_VERSION, type ServerToClientMessage, type UiSessionEvent } from "@h3code/agent-protocol";
import { AgentRuntimeWsMessageRouter, type RuntimeWsPeer } from "../src/message-router.js";

class FakeRuntime {
  listener?: (event: UiSessionEvent) => void;
  dispatched: unknown[] = [];
  async dispatchCommand(command: unknown) {
    this.dispatched.push(command);
    if ((command as { type?: string }).type === "session.create") return this.getSnapshot("s1");
    return undefined;
  }
  getSnapshot(sessionId: string) { return { id: sessionId, providerId: "fake", repoPath: "/repo", status: "idle", messages: [], activities: [], pendingInteractions: [], updatedAt: 1 }; }
  getBinding(sessionId: string) { return { sessionId, providerId: "fake", repoPath: "/repo", providerSessionRef: `${sessionId}.jsonl`, status: "running" as const }; }
  subscribe(_sessionId: string, listener: (event: UiSessionEvent) => void) { this.listener = listener; return () => { this.listener = undefined; }; }
}

class Peer implements RuntimeWsPeer {
  messages: ServerToClientMessage[] = [];
  send(message: ServerToClientMessage): void { this.messages.push(message); }
}

test("routes commands to runtime", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const router = new AgentRuntimeWsMessageRouter(runtime as never);
  await router.route(peer, { id: "req1", type: "command", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { type: "turn.send", sessionId: "s1", input: { text: "x" } } });
  assert.equal(runtime.dispatched.length, 1);
  assert.equal(peer.messages[0]?.type, "command.result");
  assert.equal(peer.messages[0]?.payload.requestId, "req1");
});

test("returns session snapshots from create session commands", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const router = new AgentRuntimeWsMessageRouter(runtime as never);

  await router.route(peer, { id: "req1", type: "command", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { type: "session.create", repoPath: "/repo", providerId: "fake" } });

  assert.equal(peer.messages[0]?.type, "command.result");
  assert.equal(peer.messages[0]?.payload.session?.id, "s1");
});

test("responds to snapshot requests", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const router = new AgentRuntimeWsMessageRouter(runtime as never);
  await router.route(peer, { id: "snap1", type: "session.snapshot.request", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { sessionId: "s1" } });
  assert.equal(peer.messages[0]?.type, "session.snapshot.response");
  assert.equal(peer.messages[0]?.payload.requestId, "snap1");
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

test("lists sessions through the workspace service", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const calls: unknown[] = [];
  const workspace = {
    listSessions: async (input: unknown) => {
      calls.push(input);
      return [{ id: "h3-s1", providerId: "fake", providerSessionRef: "/repo/s1", status: "idle" as const, repoPath: "/repo" }];
    },
  };
  const router = new AgentRuntimeWsMessageRouter(runtime as never, workspace);

  await router.route(peer, { id: "list1", type: "session.list.request", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { repoPath: "/repo", markRecent: true } });

  assert.deepEqual(calls, [{ repoPath: "/repo", markRecent: true }]);
  assert.equal(peer.messages[0]?.type, "session.list.response");
  assert.equal(peer.messages[0]?.payload.requestId, "list1");
  assert.equal(peer.messages[0]?.payload.sessions.length, 1);
});

test("deletes sessions through runtime and workspace services", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const workspaceCalls: unknown[] = [];
  const workspace = {
    listSessions: async () => [],
    deleteSession: async (input: unknown) => {
      workspaceCalls.push(input);
      return [{ id: "h3-s2", providerId: "fake", providerSessionRef: "/repo/s2", status: "idle" as const, repoPath: "/repo" }];
    },
  };
  const router = new AgentRuntimeWsMessageRouter(runtime as never, workspace);

  await router.route(peer, {
    id: "delete1",
    type: "command",
    protocolVersion: AGENT_PROTOCOL_VERSION,
    payload: { type: "session.delete", repoPath: "/repo", providerId: "fake", sessionId: "h3-s1" },
  });

  assert.deepEqual(runtime.dispatched, [{ type: "session.delete", repoPath: "/repo", providerId: "fake", sessionId: "h3-s1" }]);
  assert.deepEqual(workspaceCalls, [{ repoPath: "/repo", providerId: "fake", sessionId: "h3-s1" }]);
  assert.equal(peer.messages[0]?.type, "command.result");
  assert.equal(peer.messages[0]?.payload.sessions?.[0]?.id, "h3-s2");
});

test("errors when no workspace service is configured for session listing", async () => {
  const runtime = new FakeRuntime();
  const peer = new Peer();
  const router = new AgentRuntimeWsMessageRouter(runtime as never);

  await router.route(peer, { id: "list1", type: "session.list.request", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { repoPath: "/repo" } });

  assert.equal(peer.messages[0]?.type, "error");
  assert.equal(peer.messages[0]?.payload.code, "unsupported_message");
});
