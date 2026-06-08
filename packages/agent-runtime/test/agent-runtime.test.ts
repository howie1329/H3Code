import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderAdapter, RuntimeEventSink } from "@h3code/agent-protocol";
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

test("switches to an existing provider session and deletes active runtime state", async () => {
  let stopped = 0;
  const provider: ProviderAdapter = {
    ...fakeProvider(() => {}),
    async resumeSession(request, sink) {
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: request.providerSessionRef, occurredAt: 1 });
      return { binding: { sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: request.providerSessionRef, status: "running" }, async stop() { stopped += 1; } };
    },
  };
  const runtime = new AgentRuntime({ idFactory: () => "s2", providers: [provider] });

  const switched = await runtime.dispatchCommand({ type: "session.switch", repoPath: "/repo", providerId: "fake", providerSessionRef: "old.jsonl" });
  assert.ok(switched && "id" in switched);
  assert.equal(switched?.id, "s2");

  await runtime.dispatchCommand({ type: "session.delete", repoPath: "/repo", providerId: "fake", providerSessionRef: "old.jsonl" });

  assert.equal(stopped, 1);
  assert.equal(runtime.getSnapshot("s2"), undefined);
});
