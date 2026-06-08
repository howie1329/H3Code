import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderAdapter, RuntimeBinding, RuntimeEventSink, SessionReadModel } from "@h3code/agent-protocol";
import type { RuntimePersistence } from "@h3code/agent-runtime-persistence";
import { AgentRuntime } from "../src/agent-runtime.js";

function fakeProvider(events: RuntimeEventSink): ProviderAdapter {
  return {
    descriptor: { id: "fake", name: "Fake", capabilities: { streaming: true, sessionResume: true, approvals: true, userInputRequests: true, cancellation: true, attachments: false } },
    async startSession(request, sink) {
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: `${request.sessionId}.jsonl`, occurredAt: 1 });
      return { binding: { sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: `${request.sessionId}.jsonl`, status: "running" }, async stop() {} };
    },
    async resumeSession(request, sink) {
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: request.providerSessionRef, occurredAt: 1 });
      return { binding: { sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: request.providerSessionRef, status: "running" }, async stop() {} };
    },
    async sendTurn(binding) { await events({ type: "turn.started", sessionId: binding.sessionId, providerId: binding.providerId, turnId: "t1", occurredAt: 2 }); },
    async abortTurn() {},
    async listCommands() { return [{ name: "test", source: "prompt" }]; },
    async listModels() { return [{ id: "model", provider: "fake", modelId: "model" }]; },
    async setModel() {},
    async setThinkingLevel() {},
    async setQueueSettings() {},
    async setAutoCompaction() {},
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

test("routes provider controls and patches the session read model", async () => {
  let runtime!: AgentRuntime;
  const emitted: string[] = [];
  runtime = new AgentRuntime({ idFactory: () => "s1", providers: [fakeProvider((event) => { void runtime.ingestRuntimeEvent(event); })] });
  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo", providerId: "fake" });
  runtime.subscribe("s1", (event) => emitted.push(event.type));

  const commands = await runtime.dispatchCommand({ type: "provider.commands.list", sessionId: "s1" });
  const models = await runtime.dispatchCommand({ type: "provider.models.list", sessionId: "s1" });
  await runtime.dispatchCommand({ type: "provider.model.set", sessionId: "s1", model: { id: "model", provider: "fake", modelId: "model" } });
  await runtime.dispatchCommand({ type: "provider.thinking.set", sessionId: "s1", level: "high" });
  await runtime.dispatchCommand({ type: "provider.queue.set", sessionId: "s1", steeringMode: "all" });
  await runtime.dispatchCommand({ type: "provider.compaction.set", sessionId: "s1", enabled: true });

  assert.deepEqual(commands, { commands: [{ name: "test", source: "prompt" }] });
  assert.deepEqual(models, { models: [{ id: "model", provider: "fake", modelId: "model" }] });
  assert.equal(runtime.getSnapshot("s1")?.model?.id, "model");
  assert.equal(runtime.getSnapshot("s1")?.thinkingLevel, "high");
  assert.equal(runtime.getSnapshot("s1")?.queueSettings?.steeringMode, "all");
  assert.equal(runtime.getSnapshot("s1")?.autoCompactionEnabled, true);
  assert.deepEqual(emitted, ["session.patch", "session.patch", "session.patch", "session.patch"]);
});

test("switches to a registered session by SessionId", async () => {
  let runtime!: AgentRuntime;
  runtime = new AgentRuntime({ idFactory: () => "s1", providers: [fakeProvider((event) => { void runtime.ingestRuntimeEvent(event); })] });

  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo", providerId: "fake" });
  const switched = await runtime.dispatchCommand({ type: "session.switch", repoPath: "/repo", providerId: "fake", sessionId: "s1" });

  assert.ok(switched && "id" in switched);
  assert.equal(switched?.id, "s1");
});

test("reconciles persisted sessions through provider resume events", async () => {
  const sessions = [persistedSession("s1")];
  const bindings = [persistedBinding("s1")];
  const persistence = fakePersistence(sessions, bindings);
  const resumed: string[] = [];
  const provider: ProviderAdapter = {
    ...fakeProvider(() => {}),
    async resumeSession(request, sink) {
      resumed.push(request.providerSessionRef ?? "");
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: request.providerSessionRef, occurredAt: 1 });
      await sink({
        type: "session.updated",
        sessionId: request.sessionId,
        providerId: request.providerId,
        status: "idle",
        title: "Rebased",
        messages: [{ id: "m2", role: "assistant", content: "from provider", createdAt: 2, updatedAt: 2 }],
        occurredAt: 2,
      });
      return { binding: { ...request, status: "running" }, async stop() {} };
    },
  };
  const runtime = new AgentRuntime({ providers: [provider], persistence });

  await runtime.loadPersistedState();
  const result = await runtime.reconcilePersistedSessions({ shouldReconcile: () => true });
  const secondResult = await runtime.reconcilePersistedSessions({ shouldReconcile: () => true });

  assert.deepEqual(result, { attempted: 1, succeeded: 1, skipped: 0, failed: 0 });
  assert.deepEqual(secondResult, { attempted: 0, succeeded: 0, skipped: 1, failed: 0 });
  assert.deepEqual(resumed, ["s1.jsonl"]);
  assert.equal(runtime.getSnapshot("s1")?.title, "Rebased");
  assert.equal(runtime.getSnapshot("s1")?.messages[0]?.content, "from provider");
});

test("reconciliation failures do not stop later sessions", async () => {
  const persistence = fakePersistence(
    [persistedSession("s1"), persistedSession("s2")],
    [persistedBinding("s1"), persistedBinding("s2")],
  );
  const errors: string[] = [];
  const provider: ProviderAdapter = {
    ...fakeProvider(() => {}),
    async resumeSession(request, sink) {
      if (request.sessionId === "s1") {
        throw new Error("cannot resume");
      }
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: request.providerSessionRef, occurredAt: 1 });
      return { binding: { ...request, status: "running" }, async stop() {} };
    },
  };
  const runtime = new AgentRuntime({ providers: [provider], persistence });

  await runtime.loadPersistedState();
  const result = await runtime.reconcilePersistedSessions({
    shouldReconcile: () => true,
    onError(error) {
      errors.push(error instanceof Error ? error.message : String(error));
    },
  });

  assert.deepEqual(result, { attempted: 2, succeeded: 1, skipped: 0, failed: 1 });
  assert.deepEqual(errors, ["cannot resume"]);
  assert.equal(runtime.getSnapshot("s2")?.providerSessionRef, "s2.jsonl");
});

test("deletes a session by SessionId", async () => {
  let stopped = 0;
  let runtime!: AgentRuntime;
  const provider: ProviderAdapter = {
    ...fakeProvider((event) => { void runtime.ingestRuntimeEvent(event); }),
    async startSession(request, sink) {
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: `${request.sessionId}.jsonl`, occurredAt: 1 });
      return { binding: { sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: `${request.sessionId}.jsonl`, status: "running" }, async stop() { stopped += 1; } };
    },
  };
  runtime = new AgentRuntime({ idFactory: () => "s1", providers: [provider] });

  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo", providerId: "fake" });
  await runtime.dispatchCommand({ type: "session.delete", repoPath: "/repo", providerId: "fake", sessionId: "s1" });

  assert.equal(stopped, 1);
  assert.equal(runtime.getSnapshot("s1"), undefined);
});

function persistedSession(id: string): SessionReadModel {
  return {
    id,
    providerId: "fake",
    repoPath: "/repo",
    providerSessionRef: `${id}.jsonl`,
    status: "idle",
    messages: [],
    activities: [],
    pendingInteractions: [],
    updatedAt: 1,
  };
}

function persistedBinding(sessionId: string): RuntimeBinding {
  return {
    sessionId,
    providerId: "fake",
    repoPath: "/repo",
    providerSessionRef: `${sessionId}.jsonl`,
    status: "stopped",
  };
}

function fakePersistence(sessions: SessionReadModel[], bindings: RuntimeBinding[]): RuntimePersistence {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const bindingsById = new Map(bindings.map((binding) => [binding.sessionId, binding]));

  return {
    async loadSessions() { return [...sessionsById.values()]; },
    async loadSession(sessionId) { return sessionsById.get(sessionId); },
    async saveSession(session) { sessionsById.set(session.id, session); },
    async deleteSession(sessionId) { sessionsById.delete(sessionId); },
    async loadBindings() { return [...bindingsById.values()]; },
    async saveBinding(binding) { bindingsById.set(binding.sessionId, binding); },
    async deleteBinding(sessionId) { bindingsById.delete(sessionId); },
  };
}
