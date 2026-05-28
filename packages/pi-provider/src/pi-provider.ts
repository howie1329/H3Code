import { listPiCommands } from "./pi-commands.js";
import { listPiModels } from "./pi-models.js";
import { mapPiSessionEvent } from "./event-mapper.js";
import { PiExtensionUiBridge } from "./extension-ui.js";
import { createRealPiRuntime, withRuntimeDefaults } from "./runtime.js";
import type {
  PiProviderEvent,
  PiProviderEventListener,
  PiProviderOptions,
  PiProviderQueueMode,
  PiProviderSendResult,
  PiProviderSnapshot,
  PiProviderUiResponse,
  PiQueuedInput,
  PiRuntimeLike,
  PiSessionLike,
  PiPromptInput,
} from "./types.js";

const defaultSession = { mode: "create" as const, sessionPath: undefined };

export class PiSdkProvider {
  readonly #listeners = new Set<PiProviderEventListener>();
  readonly #runtimeFactory;
  readonly #uiBridge = new PiExtensionUiBridge((event) => this.emit(event));
  readonly #options: PiProviderOptions;
  #runtime: PiRuntimeLike | undefined;
  #services: import("./types.js").PiRuntimeServices | undefined;
  #unsubscribe: (() => void) | undefined;

  constructor(options: PiProviderOptions) {
    this.#options = options;
    this.#runtimeFactory = options.runtimeFactory ?? createRealPiRuntime;
  }

  get runtime() {
    return this.requireRuntime();
  }

  get session() {
    return this.requireRuntime().session;
  }

  async start() {
    if (this.#runtime) {
      return this.snapshot();
    }

    const runtime = await this.#runtimeFactory(
      withRuntimeDefaults({
        cwd: this.#options.cwd,
        agentDir: this.#options.agentDir ?? "",
        session: {
          mode: this.#options.session?.mode ?? defaultSession.mode,
          sessionPath: this.#options.session?.sessionPath,
        },
        authStorage: this.#options.authStorage,
        modelRegistry: this.#options.modelRegistry,
        resourceLoader: this.#options.resourceLoader,
        settingsManager: this.#options.settingsManager,
      }),
    );

    this.#runtime = runtime;
    this.#services = runtime.services;
    runtime.setRebindSession?.((session) => this.bindSession(session));
    await this.bindSession(runtime.session);
    this.emitRuntimeDiagnostics(runtime);

    const snapshot = this.snapshot();
    this.emit({ type: "session.changed", snapshot, occurredAt: Date.now() });
    return snapshot;
  }

  subscribe(listener: PiProviderEventListener): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  snapshot(): PiProviderSnapshot {
    const runtime = this.requireRuntime();
    const session = runtime.session;

    return {
      cwd: runtime.cwd,
      sessionFile: session.sessionFile,
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      messages: [...session.messages],
      streamingMessage: getStreamingMessage(session),
      isStreaming: session.isStreaming,
      isCompacting: session.isCompacting === true,
      model: session.model,
      thinkingLevel: session.thinkingLevel,
      steeringMode: asQueueMode(session.steeringMode),
      followUpMode: asQueueMode(session.followUpMode),
      autoCompactionEnabled: this.getAutoCompactionEnabled(),
      steering: session.getSteeringMessages?.() ?? [],
      followUp: session.getFollowUpMessages?.() ?? [],
      activeTools: session.getActiveToolNames?.() ?? [],
      tools: session.getAllTools?.() ?? [],
      stats: session.getSessionStats?.(),
      diagnostics: runtime.diagnostics ?? [],
      modelFallbackMessage: runtime.modelFallbackMessage,
    };
  }

  async newSession(parentSession?: string) {
    const result = await this.requireRuntime().newSession({ parentSession });
    this.emitSessionReplacement("new", result.cancelled);
    return { ...result, snapshot: this.snapshot() };
  }

  async switchSession(sessionPath: string, cwdOverride?: string) {
    const result = await this.requireRuntime().switchSession(sessionPath, { cwdOverride });
    this.emitSessionReplacement("switch", result.cancelled);
    return { ...result, snapshot: this.snapshot() };
  }

  async fork(entryId: string, position: "before" | "at" = "at") {
    const runtime = this.requireRuntime();

    if (!runtime.fork) {
      throw new Error("The active PI runtime does not support fork().");
    }

    const result = await runtime.fork(entryId, { position });
    this.emitSessionReplacement("fork", result.cancelled);
    return { ...result, snapshot: this.snapshot() };
  }

  async importFromJsonl(inputPath: string, cwdOverride?: string) {
    const runtime = this.requireRuntime();

    if (!runtime.importFromJsonl) {
      throw new Error("The active PI runtime does not support importFromJsonl().");
    }

    const result = await runtime.importFromJsonl(inputPath, cwdOverride);
    this.emitSessionReplacement("import", result.cancelled);
    return { ...result, snapshot: this.snapshot() };
  }

  prompt(input: PiPromptInput): Promise<PiProviderSendResult> {
    const session = this.session;

    return this.resolveAfterPreflight((preflightResult) =>
      session.prompt(input.text, {
        expandPromptTemplates: input.expandPromptTemplates,
        images: input.images,
        streamingBehavior: input.streamingBehavior,
        source: input.source,
        preflightResult,
      }),
    );
  }

  async steer(input: PiQueuedInput): Promise<PiProviderSendResult> {
    await this.session.steer(input.text, input.images);
    return { accepted: true };
  }

  async followUp(input: PiQueuedInput): Promise<PiProviderSendResult> {
    await this.session.followUp(input.text, input.images);
    return { accepted: true };
  }

  async abort() {
    await this.session.abort();
  }

  async setModel(model: unknown) {
    const setModel = this.session.setModel;

    if (!setModel) {
      throw new Error("The active PI session does not support model changes.");
    }

    await setModel.call(this.session, model);
  }

  setThinkingLevel(level: string) {
    const setThinkingLevel = this.session.setThinkingLevel;

    if (!setThinkingLevel) {
      throw new Error("The active PI session does not support thinking level changes.");
    }

    setThinkingLevel.call(this.session, level);
  }

  listCommands() {
    return listPiCommands(this.session, this.#services?.resourceLoader);
  }

  listModels() {
    const modelRegistry = this.#services?.modelRegistry;

    if (!modelRegistry) {
      throw new Error("PI model registry is unavailable.");
    }

    return listPiModels(modelRegistry);
  }

  setSteeringMode(mode: PiProviderQueueMode) {
    const session = this.session as PiSessionLike & { setSteeringMode?: (value: PiProviderQueueMode) => void };

    if (!session.setSteeringMode) {
      throw new Error("The active PI session does not support steering mode changes.");
    }

    session.setSteeringMode(mode);
  }

  setFollowUpMode(mode: PiProviderQueueMode) {
    const session = this.session as PiSessionLike & { setFollowUpMode?: (value: PiProviderQueueMode) => void };

    if (!session.setFollowUpMode) {
      throw new Error("The active PI session does not support follow-up mode changes.");
    }

    session.setFollowUpMode(mode);
  }

  setAutoCompactionEnabled(enabled: boolean) {
    const session = this.session as PiSessionLike & { setAutoCompactionEnabled?: (value: boolean) => void };

    if (!session.setAutoCompactionEnabled) {
      throw new Error("The active PI session does not support auto-compaction changes.");
    }

    session.setAutoCompactionEnabled(enabled);
  }

  getAutoCompactionEnabled() {
    const session = this.session as PiSessionLike & { autoCompactionEnabled?: boolean };

    return session.autoCompactionEnabled === true;
  }

  respondToUiRequest(response: PiProviderUiResponse) {
    this.#uiBridge.respond(response);
  }

  async dispose() {
    this.#uiBridge.rejectAll(new Error("PI provider disposed while extension UI requests were pending."));
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;

    if (this.#runtime) {
      const runtime = this.#runtime;
      this.#runtime = undefined;
      await runtime.dispose();
    }
  }

  private async bindSession(session: PiSessionLike) {
    this.#unsubscribe?.();
    await session.bindExtensions?.({
      uiContext: this.#uiBridge.createContext(),
      onError: (error: unknown) => {
        this.emit({
          type: "extension.error",
          message: getErrorMessage(error),
          occurredAt: Date.now(),
        });
      },
    });
    this.#unsubscribe = session.subscribe((event) => {
      for (const mapped of mapPiSessionEvent(event)) {
        this.emit(mapped);
      }
    });
  }

  private resolveAfterPreflight(operation: (preflightResult: (success: boolean) => void) => Promise<void>) {
    return new Promise<PiProviderSendResult>((resolve, reject) => {
      let settled = false;

      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      };

      const run = operation((success) => {
        settle(() => {
          if (success) {
            resolve({ accepted: true });
            return;
          }

          reject(new Error("PI rejected the prompt before starting a run."));
        });
      });

      run.then(() => {
        settle(() => resolve({ accepted: true }));
      }).catch((error: unknown) => {
        if (!settled) {
          settle(() => reject(error));
          return;
        }

        this.emit({
          type: "run.failed",
          errorMessage: getErrorMessage(error),
          occurredAt: Date.now(),
        });
      });
    });
  }

  private emitSessionReplacement(operation: "new" | "switch" | "fork" | "import", cancelled: boolean) {
    if (cancelled) {
      this.emit({ type: "session.cancelled", operation, occurredAt: Date.now() });
      return;
    }

    this.emitRuntimeDiagnostics(this.requireRuntime());
    this.emit({ type: "session.changed", snapshot: this.snapshot(), occurredAt: Date.now() });
  }

  private emitRuntimeDiagnostics(runtime: PiRuntimeLike) {
    if (runtime.modelFallbackMessage) {
      this.emit({
        type: "provider.diagnostic",
        level: "warning",
        message: runtime.modelFallbackMessage,
        occurredAt: Date.now(),
      });
    }

    for (const diagnostic of runtime.diagnostics ?? []) {
      this.emit({
        type: "provider.diagnostic",
        level: "warning",
        message: formatDiagnostic(diagnostic),
        detail: diagnostic,
        occurredAt: Date.now(),
      });
    }
  }

  private emit(event: PiProviderEvent) {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }

  private requireRuntime() {
    if (!this.#runtime) {
      throw new Error("PI provider has not been started.");
    }

    return this.#runtime;
  }
}

function getStreamingMessage(session: PiSessionLike) {
  const state = toRecord((session as { state?: unknown }).state);
  return state.streamingMessage;
}

function asQueueMode(value: unknown): PiProviderQueueMode | undefined {
  return value === "all" || value === "one-at-a-time" ? value : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatDiagnostic(diagnostic: unknown) {
  const record = toRecord(diagnostic);
  return typeof record.message === "string" ? record.message : "PI runtime diagnostic.";
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
