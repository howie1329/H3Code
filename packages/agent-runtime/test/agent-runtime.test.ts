import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderAdapter, RuntimeEventSink } from "@h3code/agent-protocol";
import { AgentRuntime } from "../src/agent-runtime.js";

function fakeProvider(events: RuntimeEventSink): ProviderAdapter {
  return {
    descriptor: { id: "fake", name: "Fake", capabilities: { streaming: true, sessionResume: true, approvals: true, userInputRequests: true, cancellation: true, attachments: false } },
    async startSession(request, sink) {
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, occurredAt: 1 });
      return { binding: { sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, status: "running" }, async stop() {} };
    },
    async resumeSession(request) { return { binding: { sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, status: "running" }, async stop() {} }; },
    async sendTurn(binding) { await events({ type: "turn.started", sessionId: binding.sessionId, providerId: binding.providerId, turnId: "t1", occurredAt: 2 }); },
    async abortTurn() {},
  };
}

test("creates sessions, stores snapshots, and emits subscription events", async () => {
  let runtime!: AgentRuntime;
  const emitted: string[] = [];
  runtime = new AgentRuntime({ idFactory: () => "s1", providers: [fakeProvider((event) => { void runtime.ingestRuntimeEvent(event); })] });

  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo", providerId: "fake" });
  runtime.subscribe("s1", (event) => emitted.push(event.type));
  await runtime.dispatchCommand({ type: "turn.send", sessionId: "s1", input: { text: "hello" } });

  assert.equal(runtime.getSnapshot("s1")?.repoPath, "/repo");
  assert.deepEqual(emitted, ["thread.message.upserted", "session.patch"]);
  assert.equal(runtime.getSnapshot("s1")?.messages[0]?.role, "user");
  assert.equal(runtime.getSnapshot("s1")?.messages[0]?.content, "hello");
});

test("clears active runtime binding when a turn completes", async () => {
  let runtime!: AgentRuntime;
  runtime = new AgentRuntime({ idFactory: () => "s1", providers: [fakeProvider((event) => { void runtime.ingestRuntimeEvent(event); })] });

  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo", providerId: "fake" });
  await runtime.dispatchCommand({ type: "turn.send", sessionId: "s1", input: { text: "hello" } });
  runtime.ingestRuntimeEvent({ type: "turn.completed", sessionId: "s1", providerId: "fake", turnId: "t1", status: "completed", occurredAt: 3 });

  assert.equal(runtime.getSnapshot("s1")?.status, "idle");
  assert.equal(runtime.getSnapshot("s1")?.activeTurnId, undefined);
});

test("does not clear interactions when provider does not support approvals", async () => {
  let runtime!: AgentRuntime;
  runtime = new AgentRuntime({ idFactory: () => "s1", providers: [fakeProvider((event) => { void runtime.ingestRuntimeEvent(event); })] });
  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo", providerId: "fake" });
  runtime.ingestRuntimeEvent({ type: "approval.requested", sessionId: "s1", providerId: "fake", requestId: "r1", payload: { command: "x" }, occurredAt: 2 });

  await assert.rejects(
    () => runtime.dispatchCommand({ type: "approval.resolve", sessionId: "s1", requestId: "r1", approved: true }),
    /Unsupported command/,
  );
  assert.equal(runtime.getSnapshot("s1")?.pendingInteractions.length, 1);
});

test("stops every active provider runtime", async () => {
  let nextSessionNumber = 1;
  let stopped = 0;
  const provider: ProviderAdapter = {
    ...fakeProvider(() => {}),
    async startSession(request, sink) {
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, occurredAt: 1 });
      return { binding: { sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, status: "running" }, async stop() { stopped += 1; } };
    },
  };
  const runtime = new AgentRuntime({ idFactory: () => `s${nextSessionNumber++}`, providers: [provider] });
  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo/a", providerId: "fake" });
  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo/b", providerId: "fake" });

  await runtime.stopAll();

  assert.equal(stopped, 2);
  assert.equal(runtime.getSnapshot("s1"), undefined);
  assert.equal(runtime.getSnapshot("s2"), undefined);
});
