import assert from "node:assert/strict";
import test from "node:test";
import { AgentRuntime } from "@h3code/agent-runtime";
import { PiProviderAdapter } from "../src/pi-provider-adapter.js";

class FakePiProvider {
  disposed = false;
  prompts: unknown[] = [];
  aborted = false;
  responses: unknown[] = [];
  model: unknown;
  thinkingLevel: string | undefined;
  steeringMode: string | undefined;
  followUpMode: string | undefined;
  autoCompactionEnabled: boolean | undefined;
  listener?: (event: unknown) => void;

  subscribe(listener: (event: unknown) => void) {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  async start() {
    this.listener?.({ type: "turn.started", occurredAt: Date.now() });
    return {
      cwd: "/repo",
      sessionFile: "/tmp/pi-session.jsonl",
      sessionId: "pi-session",
      messages: [],
      isStreaming: false,
      isCompacting: false,
      steering: [],
      followUp: [],
      activeTools: [],
      tools: [],
      diagnostics: [],
    };
  }

  async prompt(input: unknown) {
    this.prompts.push(input);
  }

  async abort() {
    this.aborted = true;
  }

  respondToUiRequest(response: unknown) {
    this.responses.push(response);
  }

  listCommands() {
    return [{ name: "ask", source: "prompt" }];
  }

  listModels() {
    return [{ id: "model", provider: "openai", modelId: "model" }];
  }

  async setModel(model: unknown) {
    this.model = model;
  }

  setThinkingLevel(level: string) {
    this.thinkingLevel = level;
  }

  setSteeringMode(mode: string) {
    this.steeringMode = mode;
  }

  setFollowUpMode(mode: string) {
    this.followUpMode = mode;
  }

  setAutoCompactionEnabled(enabled: boolean) {
    this.autoCompactionEnabled = enabled;
  }

  async dispose() {
    this.disposed = true;
  }
}

class FailingPiProvider extends FakePiProvider {
  unsubscribed = false;

  subscribe(listener: (event: unknown) => void) {
    this.listener = listener;
    return () => {
      this.unsubscribed = true;
      this.listener = undefined;
    };
  }

  async start() {
    throw new Error("boom");
    return super.start();
  }
}

test("starts a PI runtime and returns a runtime binding", async () => {
  const fake = new FakePiProvider();
  const events: unknown[] = [];
  const adapter = new PiProviderAdapter({ providerFactory: () => fake as never });

  const runtime = await adapter.startSession({ sessionId: "s1", providerId: "pi", repoPath: "/repo" }, (event) => {
    events.push(event);
  });

  assert.equal(runtime.binding.sessionId, "s1");
  assert.equal(runtime.binding.providerSessionRef, "/tmp/pi-session.jsonl");
  assert.equal(events.some((event) => (event as { type?: string }).type === "session.started"), true);

  await runtime.stop();
  assert.equal(fake.disposed, true);
});

test("maps first-pass commands to the PI provider", async () => {
  const fake = new FakePiProvider();
  const adapter = new PiProviderAdapter({ providerFactory: () => fake as never });
  const runtime = await adapter.startSession({ sessionId: "s1", providerId: "pi", repoPath: "/repo" }, () => undefined);

  await adapter.sendTurn(runtime.binding, { type: "turn.send", sessionId: "s1", input: { text: "hello" } });
  await adapter.abortTurn(runtime.binding, { type: "turn.abort", sessionId: "s1" });
  await adapter.resolveApproval(runtime.binding, { type: "approval.resolve", sessionId: "s1", requestId: "r1", approved: true });

  assert.deepEqual(fake.prompts, [{ text: "hello", images: undefined, source: "prompt" }]);
  assert.equal(fake.aborted, true);
  assert.equal(fake.responses.length, 1);
});

test("maps provider controls to the PI provider", async () => {
  const fake = new FakePiProvider();
  const adapter = new PiProviderAdapter({ providerFactory: () => fake as never });
  const runtime = await adapter.startSession({ sessionId: "s1", providerId: "pi", repoPath: "/repo" }, () => undefined);

  assert.deepEqual(await adapter.listCommands?.(runtime.binding, { type: "provider.commands.list", sessionId: "s1" }), [{ name: "ask", source: "prompt" }]);
  assert.deepEqual(await adapter.listModels?.(runtime.binding, { type: "provider.models.list", sessionId: "s1" }), [{ id: "model", provider: "openai", modelId: "model" }]);
  await adapter.setModel?.(runtime.binding, { type: "provider.model.set", sessionId: "s1", model: { id: "model", provider: "openai", modelId: "model" } });
  await adapter.setThinkingLevel?.(runtime.binding, { type: "provider.thinking.set", sessionId: "s1", level: "high" });
  await adapter.setQueueSettings?.(runtime.binding, { type: "provider.queue.set", sessionId: "s1", steeringMode: "all", followUpMode: "one-at-a-time" });
  await adapter.setAutoCompaction?.(runtime.binding, { type: "provider.compaction.set", sessionId: "s1", enabled: true });

  assert.deepEqual(fake.model, { id: "model", provider: "openai", modelId: "model" });
  assert.equal(fake.thinkingLevel, "high");
  assert.equal(fake.steeringMode, "all");
  assert.equal(fake.followUpMode, "one-at-a-time");
  assert.equal(fake.autoCompactionEnabled, true);
});

test("buffers startup PI events until runtime session is started", async () => {
  const fake = new FakePiProvider();
  const runtime = new AgentRuntime({
    idFactory: () => "s1",
    providers: [new PiProviderAdapter({ providerFactory: () => fake as never })],
  });

  await runtime.dispatchCommand({ type: "session.create", repoPath: "/repo", providerId: "pi" });

  const snapshot = runtime.getSnapshot("s1");
  assert.equal(snapshot?.repoPath, "/repo");
  assert.equal(snapshot?.activeTurnId, "s1-turn-1");
});

test("cleans up provider when startup fails", async () => {
  const fake = new FailingPiProvider();
  const adapter = new PiProviderAdapter({ providerFactory: () => fake as never });

  await assert.rejects(
    () => adapter.startSession({ sessionId: "s1", providerId: "pi", repoPath: "/repo" }, () => undefined),
    /boom/,
  );

  assert.equal(fake.unsubscribed, true);
  assert.equal(fake.disposed, true);
});
