import type {
  AgentProvider,
  ConnectContext,
  MessageInput,
  NewSessionOptions,
  ProviderCapabilities,
  ProviderConnection,
  ProviderId,
  ProviderUiRequest,
  ProviderUiResponse,
  SessionDomainEvent,
  SessionSnapshot,
} from "@h3code/agent-core";
import { PiSdkProvider } from "./pi-provider.js";
import type {
  PiProviderEvent,
  PiProviderOptions,
  PiProviderSendSource,
  PiProviderSnapshot,
  PiProviderUiRequest,
} from "./types.js";

const piCapabilities: ProviderCapabilities = {
  sessions: {
    list: false,
    create: true,
    switch: true,
    snapshot: true,
    fork: true,
    import: true,
  },
  runs: {
    stream: true,
    abort: true,
    steer: true,
    followUp: true,
    retry: true,
  },
  ui: {
    model: true,
    thinkingLevel: true,
    extensionUi: true,
    compaction: true,
    commands: true,
    modelsList: true,
    queueSettings: true,
  },
  workspace: {
    localCwd: true,
  },
};

type PiProviderFactory = (options: PiProviderOptions) => PiSdkProvider;

type PiAgentConnection = ProviderConnection & {
  provider: PiSdkProvider;
  repoPath: string;
};

export interface PiAgentProviderOptions extends Omit<PiProviderOptions, "cwd" | "session"> {
  providerFactory?: PiProviderFactory;
}

export class PiAgentProvider implements AgentProvider {
  readonly id: ProviderId = "pi";
  readonly capabilities = piCapabilities;

  readonly #providerFactory: PiProviderFactory;
  readonly #providerOptions: Omit<PiAgentProviderOptions, "providerFactory">;

  constructor(options: PiAgentProviderOptions = {}) {
    this.#providerFactory = options.providerFactory ?? ((providerOptions) => new PiSdkProvider(providerOptions));
    const { providerFactory: _providerFactory, ...providerOptions } = options;
    void _providerFactory;
    this.#providerOptions = providerOptions;
  }

  async connect(ctx: ConnectContext): Promise<PiAgentConnection> {
    const provider = this.#providerFactory({
      ...this.#providerOptions,
      cwd: ctx.repoPath,
      session: ctx.sessionRef ? { mode: "open", sessionPath: ctx.sessionRef } : { mode: "create" },
    });
    const snapshot = await provider.start();

    return {
      providerId: this.id,
      sessionRef: snapshot.sessionFile ?? snapshot.sessionId,
      provider,
      repoPath: ctx.repoPath,
    };
  }

  async disconnect(connection: ProviderConnection): Promise<void> {
    await getPiConnection(connection).provider.dispose();
  }

  async sendMessage(connection: ProviderConnection, input: MessageInput): Promise<void> {
    const provider = getPiConnection(connection).provider;

    if (input.mode === "steer") {
      await provider.steer({ text: input.text, images: input.images });
      return;
    }

    if (input.mode === "followUp") {
      await provider.followUp({ text: input.text, images: input.images });
      return;
    }

    await provider.prompt({
      text: input.text,
      images: input.images,
      source: mapSendSource(input.source),
      expandPromptTemplates: input.expandPromptTemplates,
      streamingBehavior: input.streamingBehavior,
    });
  }

  async abort(connection: ProviderConnection): Promise<void> {
    await getPiConnection(connection).provider.abort();
  }

  async setModel(connection: ProviderConnection, model: unknown): Promise<void> {
    await getPiConnection(connection).provider.setModel(model);
  }

  async setThinkingLevel(connection: ProviderConnection, level: string): Promise<void> {
    getPiConnection(connection).provider.setThinkingLevel(level);
  }

  async listCommands(connection: ProviderConnection) {
    return getPiConnection(connection).provider.listCommands();
  }

  async listModels(connection: ProviderConnection) {
    return getPiConnection(connection).provider.listModels();
  }

  async setSteeringMode(connection: ProviderConnection, mode: import("@h3code/agent-core").ProviderQueueMode) {
    getPiConnection(connection).provider.setSteeringMode(mode);
  }

  async setFollowUpMode(connection: ProviderConnection, mode: import("@h3code/agent-core").ProviderQueueMode) {
    getPiConnection(connection).provider.setFollowUpMode(mode);
  }

  async setAutoCompaction(connection: ProviderConnection, enabled: boolean) {
    getPiConnection(connection).provider.setAutoCompactionEnabled(enabled);
  }

  async respondToUiRequest(connection: ProviderConnection, response: ProviderUiResponse): Promise<void> {
    getPiConnection(connection).provider.respondToUiRequest(response);
  }

  async switchSession(connection: ProviderConnection, sessionRef: string): Promise<SessionSnapshot> {
    const piConnection = getPiConnection(connection);
    const result = await piConnection.provider.switchSession(sessionRef);
    piConnection.sessionRef = result.snapshot.sessionFile ?? result.snapshot.sessionId;
    return mapSnapshot(this.id, piConnection.repoPath, result.snapshot);
  }

  async createSession(connection: ProviderConnection, options?: NewSessionOptions): Promise<SessionSnapshot> {
    const piConnection = getPiConnection(connection);
    const result = await piConnection.provider.newSession(options?.parentSession);
    piConnection.sessionRef = result.snapshot.sessionFile ?? result.snapshot.sessionId;
    return mapSnapshot(this.id, piConnection.repoPath, result.snapshot);
  }

  async forkSession(
    connection: ProviderConnection,
    entryId: string,
    position?: "before" | "at",
  ): Promise<SessionSnapshot> {
    const piConnection = getPiConnection(connection);
    const result = await piConnection.provider.fork(entryId, position);
    piConnection.sessionRef = result.snapshot.sessionFile ?? result.snapshot.sessionId;
    return mapSnapshot(this.id, piConnection.repoPath, result.snapshot);
  }

  async importSession(
    connection: ProviderConnection,
    inputPath: string,
    cwdOverride?: string,
  ): Promise<SessionSnapshot> {
    const piConnection = getPiConnection(connection);
    const result = await piConnection.provider.importFromJsonl(inputPath, cwdOverride);
    piConnection.sessionRef = result.snapshot.sessionFile ?? result.snapshot.sessionId;
    return mapSnapshot(this.id, piConnection.repoPath, result.snapshot);
  }

  async getSnapshot(connection: ProviderConnection): Promise<SessionSnapshot> {
    const piConnection = getPiConnection(connection);
    return mapSnapshot(this.id, piConnection.repoPath, piConnection.provider.snapshot());
  }

  subscribe(connection: ProviderConnection, onEvent: (event: SessionDomainEvent) => void): () => void {
    const piConnection = getPiConnection(connection);
    return piConnection.provider.subscribe((event) => {
      onEvent(mapEvent(this.id, piConnection.repoPath, event));
    });
  }
}

export function mapPiSnapshotToCore(
  providerId: ProviderId,
  repoPath: string,
  snapshot: PiProviderSnapshot,
): SessionSnapshot {
  return mapSnapshot(providerId, repoPath, snapshot);
}

export function mapPiEventToCore(providerId: ProviderId, repoPath: string, event: PiProviderEvent): SessionDomainEvent {
  return mapEvent(providerId, repoPath, event);
}

function mapSnapshot(providerId: ProviderId, repoPath: string, snapshot: PiProviderSnapshot): SessionSnapshot {
  const sessionRef = snapshot.sessionFile ?? snapshot.sessionId;

  return {
    summary: {
      providerId,
      sessionRef,
      status: snapshot.isStreaming || snapshot.isCompacting ? "running" : "idle",
      title: snapshot.sessionName,
      repoPath,
    },
    cwd: snapshot.cwd,
    messages: snapshot.messages,
    streamingMessage: snapshot.streamingMessage,
    isStreaming: snapshot.isStreaming,
    isCompacting: snapshot.isCompacting,
    model: snapshot.model,
    thinkingLevel: snapshot.thinkingLevel,
    steeringMode: snapshot.steeringMode,
    followUpMode: snapshot.followUpMode,
    autoCompactionEnabled: snapshot.autoCompactionEnabled,
    steering: snapshot.steering,
    followUp: snapshot.followUp,
    activeTools: snapshot.activeTools,
    tools: snapshot.tools,
    stats: snapshot.stats,
    diagnostics: snapshot.diagnostics,
    modelFallbackMessage: snapshot.modelFallbackMessage,
  };
}

function mapEvent(providerId: ProviderId, repoPath: string, event: PiProviderEvent): SessionDomainEvent {
  if (event.type === "session.changed") {
    return {
      type: "session.changed",
      snapshot: mapSnapshot(providerId, repoPath, event.snapshot),
      occurredAt: event.occurredAt,
    };
  }

  if (event.type === "extension.ui.request") {
    return {
      type: "extension.ui.request",
      request: mapUiRequest(event.request),
      occurredAt: event.occurredAt,
    };
  }

  return event;
}

function mapUiRequest(request: PiProviderUiRequest): ProviderUiRequest {
  switch (request.kind) {
    case "select":
      return {
        id: request.id,
        kind: request.kind,
        title: request.title,
        message: request.message,
        options: request.options ?? [],
      };
    case "confirm":
      return {
        id: request.id,
        kind: request.kind,
        title: request.title,
        message: request.message,
      };
    case "input":
      return {
        id: request.id,
        kind: request.kind,
        title: request.title,
        message: request.message,
        placeholder: request.placeholder,
        value: request.value,
      };
    case "editor":
      return {
        id: request.id,
        kind: request.kind,
        title: request.title,
        message: request.message,
        value: request.value,
      };
  }
}

function mapSendSource(source: MessageInput["source"]): PiProviderSendSource | undefined {
  switch (source) {
    case "extension":
      return "extension";
    case "prompt":
      return "prompt";
    case "skill":
      return "skill";
    case "interactive":
      return "interactive";
    default:
      return undefined;
  }
}

function getPiConnection(connection: ProviderConnection): PiAgentConnection {
  if (!("provider" in connection) || !(connection.provider instanceof PiSdkProvider)) {
    throw new Error("Invalid PI provider connection.");
  }

  return connection as PiAgentConnection;
}
