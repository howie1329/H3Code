import type { AgentCommand, ProviderAdapter, ProviderCommand, ProviderDescriptor, ProviderModel, RuntimeEvent, SessionId, SessionReadModel, UiMessage, UiSessionEvent } from "@h3code/agent-protocol";
import { RuntimeEventBus, type RuntimeEventListener } from "./event-bus.js";
import { ProviderRegistry } from "./provider-registry.js";
import { ReadModelProjector } from "./read-model-projector.js";
import { InMemoryRuntimeStore } from "./runtime-store.js";
import { runtimeErrors } from "./errors.js";

export type AgentRuntimeOptions = {
  providers?: ProviderAdapter[];
  store?: InMemoryRuntimeStore;
  projector?: ReadModelProjector;
  idFactory?: () => SessionId;
};

export type AgentCommandResult =
  | SessionReadModel
  | { commands: ProviderCommand[] }
  | { models: ProviderModel[] }
  | void;

export class AgentRuntime {
  readonly #registry: ProviderRegistry;
  readonly #store: InMemoryRuntimeStore;
  readonly #projector: ReadModelProjector;
  readonly #bus = new RuntimeEventBus();
  readonly #idFactory: () => SessionId;

  constructor(options: AgentRuntimeOptions = {}) {
    this.#registry = new ProviderRegistry(options.providers);
    this.#store = options.store ?? new InMemoryRuntimeStore();
    this.#projector = options.projector ?? new ReadModelProjector();
    this.#idFactory = options.idFactory ?? (() => `h3-${crypto.randomUUID()}`);
  }

  registerProvider(provider: ProviderAdapter): void {
    this.#registry.register(provider);
  }

  descriptors(): ProviderDescriptor[] {
    return this.#registry.descriptors();
  }

  getSnapshot(sessionId: SessionId): SessionReadModel | undefined {
    return this.#store.getReadModel(sessionId);
  }

  subscribe(sessionId: SessionId, listener: RuntimeEventListener): () => void {
    return this.#bus.subscribe(sessionId, listener);
  }

  ingestRuntimeEvent(event: RuntimeEvent): UiSessionEvent[] {
    this.#store.appendRuntimeEvent(event);
    const result = this.#projector.apply(this.#store.getReadModel(event.sessionId), event);
    this.#store.setReadModel(result.session);
    const binding = this.#store.getBinding(event.sessionId);
    if (binding) {
      const activeTurnId = event.type === "turn.started"
        ? event.turnId
        : event.type === "turn.completed" || event.type === "session.ended" || (event.type === "session.updated" && event.status && event.status !== "running")
          ? undefined
          : binding.activeTurnId;
      this.#store.setBinding({ ...binding, lastEvent: event.type, lastEventAt: event.occurredAt, activeTurnId });
    }
    for (const uiEvent of result.events) this.#bus.emit(event.sessionId, uiEvent);
    return result.events;
  }

  ingest(event: RuntimeEvent): UiSessionEvent[] {
    return this.ingestRuntimeEvent(event);
  }

  async dispatchCommand(command: AgentCommand): Promise<AgentCommandResult> {
    switch (command.type) {
      case "session.create": {
        const sessionId = this.#idFactory();
        const provider = this.#registry.get(command.providerId);
        const runtime = await provider.startSession({ sessionId, providerId: command.providerId, repoPath: command.repoPath, options: command.options }, (event) => { void this.ingestRuntimeEvent(event); });
        this.#store.setBinding(runtime.binding);
        this.#store.setProviderRuntime(sessionId, runtime);
        return this.#store.getReadModel(sessionId);
      }
      case "session.resume": {
        const binding = this.#store.getBinding(command.sessionId);
        if (!binding) throw runtimeErrors.sessionNotFound(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        const runtime = await provider.resumeSession({ sessionId: command.sessionId, providerId: binding.providerId, repoPath: binding.repoPath, providerSessionRef: command.providerSessionRef, resumeCursor: command.resumeCursor }, (event) => { void this.ingestRuntimeEvent(event); });
        this.#store.setBinding(runtime.binding);
        this.#store.setProviderRuntime(command.sessionId, runtime);
        return this.#store.getReadModel(command.sessionId);
      }
      case "session.switch": {
        const existingBinding = this.#store.findBindingByProviderSessionRef(command.providerSessionRef);
        if (existingBinding) {
          return this.#store.getReadModel(existingBinding.sessionId);
        }

        const sessionId = this.#idFactory();
        const provider = this.#registry.get(command.providerId);
        const runtime = await provider.resumeSession(
          {
            sessionId,
            providerId: command.providerId,
            repoPath: command.repoPath,
            providerSessionRef: command.providerSessionRef,
          },
          (event) => { void this.ingestRuntimeEvent(event); },
        );
        this.#store.setBinding(runtime.binding);
        this.#store.setProviderRuntime(sessionId, runtime);
        return this.#store.getReadModel(sessionId);
      }
      case "session.delete": {
        const binding = command.sessionId
          ? this.#store.getBinding(command.sessionId)
          : this.#store.findBindingByProviderSessionRef(command.providerSessionRef);
        if (binding) {
          await this.stopSession(binding.sessionId);
        }
        return;
      }
      case "turn.send": {
        const binding = this.#requireBinding(command.sessionId);
        this.#insertUserMessage(command);
        await this.#registry.get(binding.providerId).sendTurn(binding, command);
        return;
      }
      case "turn.abort": {
        const binding = this.#requireBinding(command.sessionId);
        await this.#registry.get(binding.providerId).abortTurn(binding, command);
        return;
      }
      case "provider.commands.list": {
        const binding = this.#requireBinding(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        if (!provider.listCommands) throw runtimeErrors.unsupportedCommand(command.type);
        return { commands: await provider.listCommands(binding, command) };
      }
      case "provider.models.list": {
        const binding = this.#requireBinding(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        if (!provider.listModels) throw runtimeErrors.unsupportedCommand(command.type);
        return { models: await provider.listModels(binding, command) };
      }
      case "provider.model.set": {
        const binding = this.#requireBinding(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        if (!provider.setModel) throw runtimeErrors.unsupportedCommand(command.type);
        await provider.setModel(binding, command);
        return this.#patchSession(command.sessionId, { model: { ...command.model, providerId: binding.providerId } });
      }
      case "provider.thinking.set": {
        const binding = this.#requireBinding(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        if (!provider.setThinkingLevel) throw runtimeErrors.unsupportedCommand(command.type);
        await provider.setThinkingLevel(binding, command);
        return this.#patchSession(command.sessionId, { thinkingLevel: command.level });
      }
      case "provider.queue.set": {
        const binding = this.#requireBinding(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        if (!provider.setQueueSettings) throw runtimeErrors.unsupportedCommand(command.type);
        await provider.setQueueSettings(binding, command);
        const session = this.#store.getReadModel(command.sessionId);
        return this.#patchSession(command.sessionId, {
          queueSettings: {
            steeringMode: command.steeringMode ?? session?.queueSettings?.steeringMode,
            followUpMode: command.followUpMode ?? session?.queueSettings?.followUpMode,
          },
        });
      }
      case "provider.compaction.set": {
        const binding = this.#requireBinding(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        if (!provider.setAutoCompaction) throw runtimeErrors.unsupportedCommand(command.type);
        await provider.setAutoCompaction(binding, command);
        return this.#patchSession(command.sessionId, { autoCompactionEnabled: command.enabled });
      }
      case "approval.resolve": {
        const binding = this.#requireBinding(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        if (!provider.resolveApproval) throw runtimeErrors.unsupportedCommand(command.type);
        await provider.resolveApproval(binding, command);
        this.#resolveInteraction(command.sessionId, command.requestId);
        return;
      }
      case "user_input.resolve": {
        const binding = this.#requireBinding(command.sessionId);
        const provider = this.#registry.get(binding.providerId);
        if (!provider.resolveUserInput) throw runtimeErrors.unsupportedCommand(command.type);
        await provider.resolveUserInput(binding, command);
        this.#resolveInteraction(command.sessionId, command.requestId);
        return;
      }
      default:
        throw runtimeErrors.unsupportedCommand((command as { type: string }).type);
    }
  }

  async dispatch(command: AgentCommand): Promise<AgentCommandResult> {
    return this.dispatchCommand(command);
  }

  async stopSession(sessionId: SessionId): Promise<void> {
    const runtime = this.#store.getProviderRuntime(sessionId);
    if (!runtime) throw runtimeErrors.sessionNotFound(sessionId);
    await runtime.stop();
    this.#store.deleteSession(sessionId);
  }

  async stopAll(): Promise<void> {
    const runtimes = this.#store.listProviderRuntimes();
    for (const [sessionId, runtime] of runtimes) {
      await runtime.stop();
      this.#store.deleteSession(sessionId);
    }
  }

  #requireBinding(sessionId: SessionId) {
    const binding = this.#store.getBinding(sessionId);
    if (!binding) throw runtimeErrors.sessionNotFound(sessionId);
    return binding;
  }

  #resolveInteraction(sessionId: SessionId, requestId: string): void {
    const session = this.#store.getReadModel(sessionId);
    if (session) this.#store.setReadModel({ ...session, pendingInteractions: session.pendingInteractions.filter((item) => item.id !== requestId), updatedAt: Date.now() });
    this.#bus.emit(sessionId, { type: "interaction.resolved", sessionId, requestId });
  }

  #insertUserMessage(command: Extract<AgentCommand, { type: "turn.send" }>): void {
    const text = command.input.text?.trim();
    if (!text) return;

    const session = this.#store.getReadModel(command.sessionId);
    if (!session) return;

    const now = Date.now();
    const message: UiMessage = {
      id: `msg:${command.sessionId}:user:${now}`,
      sessionId: command.sessionId,
      role: "user",
      content: text,
      status: "completed",
      createdAt: now,
      updatedAt: now,
      metadata: command.input.metadata,
    };

    this.#store.setReadModel({
      ...session,
      messages: [...session.messages, message],
      updatedAt: now,
    });
    this.#bus.emit(command.sessionId, { type: "thread.message.upserted", sessionId: command.sessionId, message });
  }

  #patchSession(sessionId: SessionId, patch: Partial<SessionReadModel>): SessionReadModel {
    const current = this.#store.getReadModel(sessionId);
    if (!current) throw runtimeErrors.sessionNotFound(sessionId);
    const updatedAt = Date.now();
    const session = { ...current, ...patch, updatedAt };
    this.#store.setReadModel(session);
    this.#bus.emit(sessionId, {
      type: "session.patch",
      sessionId,
      patch: {
        model: patch.model ?? undefined,
        thinkingLevel: patch.thinkingLevel ?? undefined,
        queueSettings: patch.queueSettings ?? undefined,
        autoCompactionEnabled: patch.autoCompactionEnabled ?? undefined,
        updatedAt,
      },
    });
    return session;
  }
}
