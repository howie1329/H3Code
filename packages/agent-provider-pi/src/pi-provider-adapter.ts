import { PiSdkProvider } from "./pi-sdk/pi-provider.js";
import type {
  AbortTurnCommand,
  ListProviderCommandsCommand,
  ListProviderModelsCommand,
  ProviderAdapter,
  ProviderDescriptor,
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
import type { PiProviderOptions, PiProviderUiResponse } from "./pi-sdk/types.js";
import { createPiRuntimeEventMapperState, mapPiEventToRuntimeEvents } from "./event-mapper.js";

export type PiProviderFactory = (options: PiProviderOptions) => PiSdkProvider;

export type PiProviderAdapterOptions = Omit<PiProviderOptions, "cwd" | "session"> & {
  providerFactory?: PiProviderFactory;
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
  readonly #sessions = new Map<string, PiSdkProvider>();

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
    const provider = this.#requireProvider(binding);
    await provider.prompt({ text: command.input.text ?? "", images: command.input.attachments, source: "prompt" });
  }

  async abortTurn(binding: RuntimeBinding, _command: AbortTurnCommand): Promise<void> {
    await this.#requireProvider(binding).abort();
  }

  async listCommands(binding: RuntimeBinding, _command: ListProviderCommandsCommand) {
    return this.#requireProvider(binding).listCommands();
  }

  async listModels(binding: RuntimeBinding, _command: ListProviderModelsCommand) {
    return this.#requireProvider(binding).listModels();
  }

  async setModel(binding: RuntimeBinding, command: SetProviderModelCommand): Promise<void> {
    await this.#requireProvider(binding).setModel(command.model);
  }

  async setThinkingLevel(binding: RuntimeBinding, command: SetProviderThinkingCommand): Promise<void> {
    this.#requireProvider(binding).setThinkingLevel(command.level);
  }

  async setQueueSettings(binding: RuntimeBinding, command: SetProviderQueueCommand): Promise<void> {
    const provider = this.#requireProvider(binding);
    if (command.steeringMode) provider.setSteeringMode(command.steeringMode);
    if (command.followUpMode) provider.setFollowUpMode(command.followUpMode);
  }

  async setAutoCompaction(binding: RuntimeBinding, command: SetProviderCompactionCommand): Promise<void> {
    this.#requireProvider(binding).setAutoCompactionEnabled(command.enabled);
  }

  async resolveApproval(binding: RuntimeBinding, command: ResolveApprovalCommand): Promise<void> {
    this.#requireProvider(binding).respondToUiRequest({
      requestId: command.requestId,
      kind: "confirm",
      accepted: command.approved,
      value: command.response,
    } as PiProviderUiResponse);
  }

  async resolveUserInput(binding: RuntimeBinding, command: ResolveUserInputCommand): Promise<void> {
    const value = typeof command.input === "string" ? command.input : JSON.stringify(command.input);
    this.#requireProvider(binding).respondToUiRequest({ requestId: command.requestId, kind: "input", value });
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
    } catch (error) {
      unsubscribe();
      await provider.dispose();
      throw error;
    }
    this.#sessions.set(request.sessionId, provider);
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
    for (const runtimeEvent of pendingStartupEvents) void events(runtimeEvent);

    return {
      binding,
      stop: async () => {
        unsubscribe();
        this.#sessions.delete(request.sessionId);
        await provider.dispose();
      },
    };
  }

  #requireProvider(binding: RuntimeBinding): PiSdkProvider {
    const provider = this.#sessions.get(binding.sessionId);
    if (!provider) throw new Error(`PI provider session not found: ${binding.sessionId}`);
    return provider;
  }
}
