import assert from "node:assert/strict";
import { test } from "node:test";
import { PiSdkProvider, type PiProviderEvent, type PiRuntimeFactory, type PiRuntimeLike, type PiSessionLike } from "../src/index.js";

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

function fakeFactory(runtime: PiRuntimeLike): PiRuntimeFactory {
  return async () => runtime;
}

class FakeRuntime implements PiRuntimeLike {
  nextSession: FakeSession | undefined;
  disposed = false;
  #rebindSession: ((session: PiSessionLike) => Promise<void>) | undefined;

  constructor(public session: FakeSession) {}

  get cwd() {
    return "/repo";
  }

  setRebindSession(rebindSession?: (session: PiSessionLike) => Promise<void>) {
    this.#rebindSession = rebindSession;
  }

  async newSession() {
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
  steering: string[] = [];
  followUps: string[] = [];
  bindCount = 0;
  isStreamingValue = false;
  model: unknown;
  thinkingLevel: string | undefined;
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
