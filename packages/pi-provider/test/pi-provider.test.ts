import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PiAgentProvider,
  PiSdkProvider,
  mapPiEventToCore,
  mapPiSnapshotToCore,
  type PiProviderEvent,
  type PiRuntimeFactory,
  type PiRuntimeLike,
  type PiSessionLike,
} from "../src/index.js";

test("starts runtime with injected options and emits initial session snapshot", async () => {
  const session = new FakeSession("session-1");
  const runtime = new FakeRuntime(session);
  let receivedCwd = "";
  const events: PiProviderEvent[] = [];
  const provider = new PiSdkProvider({
    cwd: "/repo",
    agentDir: "/agent",
    session: { mode: "continueRecent" },
    authStorage: {} as never,
    modelRegistry: {} as never,
    settingsManager: {} as never,
    resourceLoader: {} as never,
    runtimeFactory: async (options) => {
      receivedCwd = options.cwd;
      assert.equal(options.agentDir, "/agent");
      assert.equal(options.session.mode, "continueRecent");
      assert.ok(options.authStorage);
      assert.ok(options.modelRegistry);
      assert.ok(options.settingsManager);
      assert.ok(options.resourceLoader);
      return runtime;
    },
  });
  provider.subscribe((event) => events.push(event));

  const snapshot = await provider.start();

  assert.equal(receivedCwd, "/repo");
  assert.equal(snapshot.sessionId, "session-1");
  assert.equal(events.at(-1)?.type, "session.changed");
  assert.equal(session.bindCount, 1);
  await provider.dispose();
  assert.equal(runtime.disposed, true);
});

test("newSession rebinds listeners to the replacement session", async () => {
  const first = new FakeSession("first");
  const second = new FakeSession("second");
  const runtime = new FakeRuntime(first);
  runtime.nextSession = second;
  const events: PiProviderEvent[] = [];
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(runtime) });
  provider.subscribe((event) => events.push(event));
  await provider.start();

  first.emit({ type: "agent_start" });
  await provider.newSession();
  first.emit({ type: "agent_start" });
  second.emit({ type: "turn_start" });

  assert.deepEqual(
    events.filter((event) => event.type === "run.started" || event.type === "turn.started").map((event) => event.type),
    ["run.started", "turn.started"],
  );
  assert.equal(first.listenerCount, 0);
  assert.equal(second.bindCount, 1);
  assert.equal(provider.snapshot().sessionId, "second");
});

test("prompt resolves on preflight acceptance and reports later failures as events", async () => {
  const session = new FakeSession("session");
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(new FakeRuntime(session)) });
  const events: PiProviderEvent[] = [];
  provider.subscribe((event) => events.push(event));
  await provider.start();

  session.promptImpl = async (_text, options) => {
    options?.preflightResult?.(true);
    throw new Error("model failed after acceptance");
  };

  await assert.doesNotReject(provider.prompt({ text: "hello" }));
  await Promise.resolve();

  assert.equal(events.at(-1)?.type, "run.failed");
  assert.equal((events.at(-1) as Extract<PiProviderEvent, { type: "run.failed" }>).errorMessage, "model failed after acceptance");
});

test("prompt rejects when Pi preflight rejects", async () => {
  const session = new FakeSession("session");
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(new FakeRuntime(session)) });
  await provider.start();

  session.promptImpl = async (_text, options) => {
    options?.preflightResult?.(false);
  };

  await assert.rejects(provider.prompt({ text: "hello" }), /rejected/);
});

test("steer and followUp use explicit session methods", async () => {
  const session = new FakeSession("session");
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(new FakeRuntime(session)) });
  await provider.start();

  await provider.steer({ text: "interrupt" });
  await provider.followUp({ text: "later" });

  assert.deepEqual(session.steering, ["interrupt"]);
  assert.deepEqual(session.followUps, ["later"]);
});

test("extension UI requests resolve through respondToUiRequest", async () => {
  const session = new FakeSession("session");
  let uiContext: Record<string, unknown> | undefined;
  session.bindExtensionsImpl = async (bindings) => {
    uiContext = (bindings as { uiContext: Record<string, unknown> }).uiContext;
  };
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(new FakeRuntime(session)) });
  const events: PiProviderEvent[] = [];
  provider.subscribe((event) => events.push(event));
  await provider.start();

  const selected = (uiContext?.select as (title: string, options: string[]) => Promise<string | undefined>)("Pick", [
    "A",
    "B",
  ]);
  const request = events.find((event): event is Extract<PiProviderEvent, { type: "extension.ui.request" }> =>
    event.type === "extension.ui.request",
  )?.request;
  assert.ok(request);

  provider.respondToUiRequest({ requestId: request.id, kind: "select", value: "B" });

  assert.equal(await selected, "B");
  assert.equal(events.at(-1)?.type, "extension.ui.resolved");
});

test("snapshot preserves Pi message objects and session settings", async () => {
  const message = { id: "m1", role: "assistant", content: [{ type: "text", text: "hi" }] };
  const session = new FakeSession("session");
  session.messages.push(message);
  session.isStreamingValue = true;
  session.model = { provider: "test", id: "model" };
  session.thinkingLevel = "medium";
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(new FakeRuntime(session)) });
  await provider.start();

  const snapshot = provider.snapshot();

  assert.deepEqual(snapshot.messages, [message]);
  assert.equal(snapshot.isStreaming, true);
  assert.deepEqual(snapshot.model, { provider: "test", id: "model" });
  assert.equal(snapshot.thinkingLevel, "medium");
});

test("maps Pi snapshots and events to agent-core shapes", async () => {
  const message = { id: "m1", role: "assistant", content: [{ type: "text", text: "hi" }] };
  const session = new FakeSession("session");
  session.messages.push(message);
  session.isStreamingValue = true;
  session.isCompactingValue = true;
  session.model = { provider: "test", id: "model" };
  session.thinkingLevel = "high";
  session.steering.push("now");
  session.followUps.push("later");
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(new FakeRuntime(session)) });
  await provider.start();

  const snapshot = mapPiSnapshotToCore("pi", "/repo", provider.snapshot());

  assert.equal(snapshot.summary.providerId, "pi");
  assert.equal(snapshot.summary.sessionRef, "/tmp/session.jsonl");
  assert.equal(snapshot.summary.status, "running");
  assert.equal(snapshot.cwd, "/repo");
  assert.deepEqual(snapshot.messages, [message]);
  assert.deepEqual(snapshot.steering, ["now"]);
  assert.deepEqual(snapshot.followUp, ["later"]);
  assert.deepEqual(snapshot.activeTools, ["read"]);
  assert.deepEqual(snapshot.tools, [{ name: "read" }]);
  assert.deepEqual(snapshot.model, { provider: "test", id: "model" });
  assert.equal(snapshot.thinkingLevel, "high");

  const changed = mapPiEventToCore("pi", "/repo", {
    type: "session.changed",
    snapshot: provider.snapshot(),
    occurredAt: 1,
  });
  assert.equal(changed.type, "session.changed");
  assert.equal(changed.snapshot.summary.sessionRef, "/tmp/session.jsonl");

  const queue = mapPiEventToCore("pi", "/repo", {
    type: "queue.updated",
    steering: ["a"],
    followUp: ["b"],
    occurredAt: 2,
  });
  assert.deepEqual(queue, { type: "queue.updated", steering: ["a"], followUp: ["b"], occurredAt: 2 });
});

test("PiAgentProvider adapts core commands to PiSdkProvider", async () => {
  const session = new FakeSession("session");
  const runtime = new FakeRuntime(session);
  const provider = new PiAgentProvider({ runtimeFactory: fakeFactory(runtime) });
  const events: string[] = [];
  const connection = await provider.connect({ repoPath: "/repo" });
  provider.subscribe(connection, (event) => events.push(event.type));

  await provider.sendMessage(connection, {
    mode: "prompt",
    text: "hello",
    images: ["image"],
    source: "prompt",
    expandPromptTemplates: true,
    streamingBehavior: "followUp",
  });
  await provider.sendMessage(connection, { mode: "steer", text: "interrupt" });
  await provider.sendMessage(connection, { mode: "followUp", text: "later" });
  await provider.setModel?.(connection, { id: "model" });
  await provider.setThinkingLevel?.(connection, "medium");
  session.emit({ type: "agent_start" });

  assert.equal(session.prompts[0]?.text, "hello");
  assert.deepEqual(session.prompts[0]?.options?.images, ["image"]);
  assert.equal(session.prompts[0]?.options?.source, "prompt");
  assert.equal(session.prompts[0]?.options?.expandPromptTemplates, true);
  assert.equal(session.prompts[0]?.options?.streamingBehavior, "followUp");
  assert.deepEqual(session.steering, ["interrupt"]);
  assert.deepEqual(session.followUps, ["later"]);
  assert.deepEqual(session.model, { id: "model" });
  assert.equal(session.thinkingLevel, "medium");
  assert.deepEqual(events, ["run.started"]);

  const next = new FakeSession("next");
  runtime.nextSession = next;
  const snapshot = await provider.createSession?.(connection, { parentSession: "parent" });
  assert.equal(snapshot?.summary.sessionRef, "/tmp/next.jsonl");
  assert.equal(runtime.parentSession, "parent");

  await provider.disconnect(connection);
  assert.equal(runtime.disposed, true);
});

test("lists commands and models from session and runtime services", async () => {
  const session = new FakeSession("session");
  session.extensionRunner = {
    getRegisteredCommands: () => [{ invocationName: "help", description: "Help" }],
  };
  session.promptTemplates = [{ name: "review", description: "Review code" }];
  const runtime = new FakeRuntime(session);
  runtime.services = {
    modelRegistry: {
      getAvailable: () => [{ id: "gpt-4", provider: "openai", name: "GPT-4", reasoning: false }],
    } as never,
    resourceLoader: {
      getSkills: () => ({ skills: [{ name: "commit", description: "Commit skill" }] }),
    } as never,
  };
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(runtime) });
  await provider.start();

  const commands = provider.listCommands();
  assert.ok(commands.some((command) => command.name === "help"));
  assert.ok(commands.some((command) => command.name === "review"));
  assert.ok(commands.some((command) => command.name === "skill:commit"));

  const models = provider.listModels();
  assert.equal(models[0]?.provider, "openai");
});

test("queue and compaction setters update the active session", async () => {
  const session = new FakeSession("session");
  const provider = new PiSdkProvider({ cwd: "/repo", runtimeFactory: fakeFactory(new FakeRuntime(session)) });
  await provider.start();

  provider.setSteeringMode("all");
  provider.setFollowUpMode("all");
  provider.setAutoCompactionEnabled(false);

  assert.equal(session.steeringMode, "all");
  assert.equal(session.followUpMode, "all");
  assert.equal(session.autoCompactionEnabled, false);
  assert.equal(provider.getAutoCompactionEnabled(), false);
});

function fakeFactory(runtime: PiRuntimeLike): PiRuntimeFactory {
  return async () => runtime;
}

class FakeRuntime implements PiRuntimeLike {
  nextSession: FakeSession | undefined;
  disposed = false;
  parentSession: string | undefined;
  services: import("../src/types.js").PiRuntimeServices | undefined;
  #rebindSession: ((session: PiSessionLike) => Promise<void>) | undefined;

  constructor(public session: FakeSession) {}

  get cwd() {
    return "/repo";
  }

  setRebindSession(rebindSession?: (session: PiSessionLike) => Promise<void>) {
    this.#rebindSession = rebindSession;
  }

  async newSession(options?: { parentSession?: string }) {
    this.parentSession = options?.parentSession;
    if (this.nextSession) {
      this.session = this.nextSession;
      await this.#rebindSession?.(this.session);
    }

    return { cancelled: false };
  }

  async switchSession() {
    if (this.nextSession) {
      this.session = this.nextSession;
      await this.#rebindSession?.(this.session);
    }

    return { cancelled: false };
  }

  async dispose() {
    this.disposed = true;
  }
}

class FakeSession implements PiSessionLike {
  messages: unknown[] = [];
  prompts: Array<{ text: string; options?: Parameters<PiSessionLike["prompt"]>[1] }> = [];
  steering: string[] = [];
  followUps: string[] = [];
  bindCount = 0;
  isStreamingValue = false;
  isCompactingValue = false;
  model: unknown;
  thinkingLevel: string | undefined;
  steeringMode: import("../src/types.js").PiProviderQueueMode | undefined;
  followUpMode: import("../src/types.js").PiProviderQueueMode | undefined;
  autoCompactionEnabled = true;
  extensionRunner:
    | { getRegisteredCommands: () => Array<{ invocationName: string; description?: string }> }
    | undefined;
  promptTemplates: Array<{ name: string; description?: string }> | undefined;
  promptImpl: PiSessionLike["prompt"] | undefined;
  bindExtensionsImpl: ((bindings: unknown) => Promise<void>) | undefined;
  readonly #listeners = new Set<(event: unknown) => void>();

  constructor(readonly sessionId: string) {}

  get sessionFile() {
    return `/tmp/${this.sessionId}.jsonl`;
  }

  get isStreaming() {
    return this.isStreamingValue;
  }

  get isCompacting() {
    return this.isCompactingValue;
  }

  get listenerCount() {
    return this.#listeners.size;
  }

  subscribe(listener: (event: unknown) => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async bindExtensions(bindings: unknown) {
    this.bindCount += 1;
    await this.bindExtensionsImpl?.(bindings);
  }

  async prompt(text: string, options?: Parameters<PiSessionLike["prompt"]>[1]) {
    this.prompts.push({ text, options });
    if (this.promptImpl) {
      await this.promptImpl(text, options);
      return;
    }

    options?.preflightResult?.(true);
  }

  async steer(text: string) {
    this.steering.push(text);
  }

  async followUp(text: string) {
    this.followUps.push(text);
  }

  async abort() {}

  async setModel(model: unknown) {
    this.model = model;
  }

  setThinkingLevel(level: string) {
    this.thinkingLevel = level;
  }

  setSteeringMode(mode: import("../src/types.js").PiProviderQueueMode) {
    this.steeringMode = mode;
  }

  setFollowUpMode(mode: import("../src/types.js").PiProviderQueueMode) {
    this.followUpMode = mode;
  }

  setAutoCompactionEnabled(enabled: boolean) {
    this.autoCompactionEnabled = enabled;
  }

  getSteeringMessages() {
    return this.steering;
  }

  getFollowUpMessages() {
    return this.followUps;
  }

  getActiveToolNames() {
    return ["read"];
  }

  getAllTools() {
    return [{ name: "read" }];
  }

  getSessionStats() {
    return { sessionId: this.sessionId };
  }

  emit(event: unknown) {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }
}
