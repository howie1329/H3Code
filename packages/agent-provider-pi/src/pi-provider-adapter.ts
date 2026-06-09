import { PiSdkProvider } from "./pi-sdk/pi-provider.js";
import type {
  AbortTurnCommand,
  DiscoverProviderModelsCommand,
  ListProviderCommandsCommand,
  ListProviderModelsCommand,
  ProviderAdapter,
  ProviderDescriptor,
  ProviderModel,
  ProviderRuntime,
  ResolveApprovalCommand,
  ResolveUserInputCommand,
  RuntimeBinding,
  RuntimeEventSink,
  SendTurnCommand,
  StartProviderSessionRequest,
  ResumeProviderSessionRequest,
  RuntimeEvent,
  SetProviderCompactionCommand,
  SetProviderModelCommand,
  SetProviderQueueCommand,
  SetProviderThinkingCommand,
} from "@h3code/agent-protocol";
import type { PiProviderOptions, PiProviderSnapshot, PiProviderUiResponse } from "./pi-sdk/types.js";
import { createPiRuntimeEventMapperState, mapPiEventToRuntimeEvents } from "./event-mapper.js";
import { discoverPiModels } from "./pi-sdk/pi-models.js";

export type PiProviderFactory = (options: PiProviderOptions) => PiSdkProvider;

export type PiProviderAdapterOptions = Omit<PiProviderOptions, "cwd" | "session"> & {
  providerFactory?: PiProviderFactory;
};

type PiSessionContext = {
  provider: PiSdkProvider;
  events: RuntimeEventSink;
  mapperState: ReturnType<typeof createPiRuntimeEventMapperState>;
  providerId: string;
  sessionId: string;
};

export class PiProviderAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor = {
    id: "pi",
    name: "PI Agent",
    capabilities: {
      streaming: true,
      sessionResume: true,
      approvals: true,
      userInputRequests: true,
      cancellation: true,
      attachments: true,
      modes: ["default", "plan"],
      controls: {
        slashCommands: true,
        model: true,
        thinkingLevel: true,
        queueSettings: true,
        autoCompaction: true,
        sessionSwitching: true,
        sessionDeletion: true,
      },
      metadata: {
        advancedControls: false,
        deferredControls: ["fork", "import"],
      },
    },
  };

  readonly #providerFactory: PiProviderFactory;
  readonly #providerOptions: Omit<PiProviderAdapterOptions, "providerFactory">;
  readonly #sessions = new Map<string, PiSessionContext>();

  constructor(options: PiProviderAdapterOptions = {}) {
    this.#providerFactory = options.providerFactory ?? ((providerOptions) => new PiSdkProvider(providerOptions));
    const { providerFactory: _providerFactory, ...providerOptions } = options;
    void _providerFactory;
    this.#providerOptions = providerOptions;
  }

  async startSession(request: StartProviderSessionRequest, events: RuntimeEventSink): Promise<ProviderRuntime> {
    return this.#openSession(request, events, { mode: "create" });
  }

  async resumeSession(request: ResumeProviderSessionRequest, events: RuntimeEventSink): Promise<ProviderRuntime> {
    return this.#openSession(request, events, request.providerSessionRef ? { mode: "open", sessionPath: request.providerSessionRef } : { mode: "continueRecent" });
  }

  async sendTurn(binding: RuntimeBinding, command: SendTurnCommand): Promise<void> {
    const context = this.#requireContext(binding);
    await context.provider.prompt({ text: command.input.text ?? "", images: command.input.attachments, source: "prompt" });
    await this.#emitCompletedActiveTurn(context);
    await this.#emitSnapshotUpdate(context, context.provider.snapshot(), { includeSnapshotMessages: false });
  }

  async abortTurn(binding: RuntimeBinding, _command: AbortTurnCommand): Promise<void> {
    await this.#requireContext(binding).provider.abort();
  }

  async listCommands(binding: RuntimeBinding, _command: ListProviderCommandsCommand) {
    return this.#requireContext(binding).provider.listCommands();
  }

  async discoverModels(_command: DiscoverProviderModelsCommand) {
    return discoverPiModels({
      agentDir: this.#providerOptions.agentDir,
      authStorage: this.#providerOptions.authStorage,
      modelRegistry: this.#providerOptions.modelRegistry,
    });
  }

  async listModels(binding: RuntimeBinding, _command: ListProviderModelsCommand) {
    return this.#requireContext(binding).provider.listModels();
  }

  async setModel(binding: RuntimeBinding, command: SetProviderModelCommand): Promise<void> {
    await this.#requireContext(binding).provider.setModel(command.model);
  }

  async setThinkingLevel(binding: RuntimeBinding, command: SetProviderThinkingCommand): Promise<void> {
    this.#requireContext(binding).provider.setThinkingLevel(command.level);
  }

  async setQueueSettings(binding: RuntimeBinding, command: SetProviderQueueCommand): Promise<void> {
    const provider = this.#requireContext(binding).provider;
    if (command.steeringMode) provider.setSteeringMode(command.steeringMode);
    if (command.followUpMode) provider.setFollowUpMode(command.followUpMode);
  }

  async setAutoCompaction(binding: RuntimeBinding, command: SetProviderCompactionCommand): Promise<void> {
    this.#requireContext(binding).provider.setAutoCompactionEnabled(command.enabled);
  }

  async resolveApproval(binding: RuntimeBinding, command: ResolveApprovalCommand): Promise<void> {
    this.#requireContext(binding).provider.respondToUiRequest({
      requestId: command.requestId,
      kind: "confirm",
      accepted: command.approved,
      value: command.response,
    } as PiProviderUiResponse);
  }

  async resolveUserInput(binding: RuntimeBinding, command: ResolveUserInputCommand): Promise<void> {
    const value = typeof command.input === "string" ? command.input : JSON.stringify(command.input);
    this.#requireContext(binding).provider.respondToUiRequest({ requestId: command.requestId, kind: "input", value });
  }

  async #openSession(
    request: StartProviderSessionRequest | ResumeProviderSessionRequest,
    events: RuntimeEventSink,
    session: PiProviderOptions["session"],
  ): Promise<ProviderRuntime> {
    const provider = this.#providerFactory({ ...this.#providerOptions, cwd: request.repoPath, session });
    const mapperState = createPiRuntimeEventMapperState();
    const pendingStartupEvents: RuntimeEvent[] = [];
    let started = false;
    const unsubscribe = provider.subscribe((event) => {
      for (const runtimeEvent of mapPiEventToRuntimeEvents(event, { sessionId: request.sessionId, providerId: request.providerId, state: mapperState })) {
        if (!started) {
          pendingStartupEvents.push(runtimeEvent);
          continue;
        }
        void events(runtimeEvent);
      }
    });

    let snapshot;
    try {
      snapshot = await provider.start();
      const requestedModel = getRequestedModel(request.options);

      if (requestedModel) {
        await provider.setModel(requestedModel);
        snapshot = provider.snapshot();
      }

      const requestedThinkingLevel = getRequestedThinkingLevel(request.options);

      if (requestedThinkingLevel) {
        provider.setThinkingLevel(requestedThinkingLevel);
        snapshot = provider.snapshot();
      }
    } catch (error) {
      unsubscribe();
      await provider.dispose();
      throw error;
    }
    const context: PiSessionContext = {
      provider,
      events,
      mapperState,
      providerId: request.providerId,
      sessionId: request.sessionId,
    };
    this.#sessions.set(request.sessionId, context);
    const providerSessionRef = snapshot.sessionFile ?? snapshot.sessionId;
    const binding: RuntimeBinding = {
      sessionId: request.sessionId,
      providerId: request.providerId,
      repoPath: request.repoPath,
      providerSessionRef,
      status: "running",
      lastEventAt: Date.now(),
    };

    await events({
      type: "session.started",
      sessionId: request.sessionId,
      providerId: request.providerId,
      repoPath: request.repoPath,
      providerSessionRef,
      occurredAt: Date.now(),
    });
    started = true;
    for (const runtimeEvent of pendingStartupEvents) await events(runtimeEvent);
    if (!snapshot.isStreaming && !snapshot.isCompacting) {
      await this.#emitCompletedActiveTurn(context);
      await this.#emitSnapshotUpdate(context, snapshot, { includeSnapshotMessages: true });
    }

    return {
      binding,
      stop: async () => {
        unsubscribe();
        this.#sessions.delete(request.sessionId);
        await provider.dispose();
      },
    };
  }

  #requireContext(binding: RuntimeBinding): PiSessionContext {
    const context = this.#sessions.get(binding.sessionId);
    if (!context) throw new Error(`PI provider session not found: ${binding.sessionId}`);
    return context;
  }

  async #emitCompletedActiveTurn(context: PiSessionContext): Promise<void> {
    const turnId = context.mapperState.turnId;
    if (!turnId) return;

    context.mapperState.turnId = undefined;
    context.mapperState.assistantItemId = undefined;
    await context.events({
      type: "turn.completed",
      sessionId: context.sessionId,
      providerId: context.providerId,
      turnId,
      status: "completed",
      occurredAt: Date.now(),
    });
  }

  async #emitSnapshotUpdate(
    context: PiSessionContext,
    snapshot: PiProviderSnapshot,
    options: { includeSnapshotMessages: boolean },
  ): Promise<void> {
    for (const runtimeEvent of mapPiEventToRuntimeEvents(
      { type: "session.changed", snapshot, occurredAt: Date.now() },
      {
        sessionId: context.sessionId,
        providerId: context.providerId,
        state: context.mapperState,
        includeSnapshotMessages: options.includeSnapshotMessages,
      },
    )) {
      await context.events(runtimeEvent);
    }
  }
}

function getRequestedModel(options: unknown): ProviderModel | undefined {
  if (!options || typeof options !== "object" || !("model" in options)) {
    return undefined;
  }

  const model = (options as { model?: unknown }).model;

  if (!model || typeof model !== "object") {
    return undefined;
  }

  const id = (model as { id?: unknown }).id;
  const modelId = (model as { modelId?: unknown }).modelId;

  if (typeof id !== "string" || id.length === 0) {
    return undefined;
  }

  return {
    ...(model as ProviderModel),
    id,
    modelId: typeof modelId === "string" && modelId.length > 0 ? modelId : id,
  };
}

function getRequestedThinkingLevel(options: unknown): string | undefined {
  if (!options || typeof options !== "object" || !("thinkingLevel" in options)) {
    return undefined;
  }

  const level = (options as { thinkingLevel?: unknown }).thinkingLevel;
  return typeof level === "string" && level.length > 0 ? level : undefined;
}
