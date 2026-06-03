import type {
  AgentProvider,
  ConnectContext,
  NewSessionOptions,
  ProviderCapabilities,
  ProviderCommand,
  ProviderConnection,
  ProviderModel,
  ProviderQueueMode,
  ProviderUiResponse,
  SessionDomainEvent,
  SessionRef,
  SessionSnapshot,
} from "@h3code/agent-core";

const uiCapabilities: ProviderCapabilities = {
  sessions: {
    list: false,
    create: false,
    switch: false,
    snapshot: true,
    fork: false,
    import: false,
  },
  runs: { stream: false, abort: false, steer: false, followUp: false, retry: false },
  ui: {
    model: false,
    thinkingLevel: false,
    extensionUi: true,
    compaction: false,
    commands: false,
    modelsList: false,
    queueSettings: false,
  },
  workspace: { localCwd: true },
};

export class FakeUiProvider implements AgentProvider {
  readonly id = "fake-ui";
  readonly capabilities = uiCapabilities;

  readonly #listeners = new WeakMap<ProviderConnection, Set<(event: SessionDomainEvent) => void>>();

  async connect(ctx: ConnectContext): Promise<ProviderConnection> {
    return { providerId: this.id, sessionRef: ctx.sessionRef ?? "fake-ui-session" };
  }

  async disconnect(connection: ProviderConnection): Promise<void> {
    this.#listeners.delete(connection);
  }

  async abort(_connection: ProviderConnection): Promise<void> {}

  async setModel(): Promise<void> {}

  async setThinkingLevel(): Promise<void> {}

  async listCommands(): Promise<ProviderCommand[]> {
    return [];
  }

  async listModels(): Promise<ProviderModel[]> {
    return [];
  }

  async setSteeringMode(_connection: ProviderConnection, _mode: ProviderQueueMode): Promise<void> {}

  async setFollowUpMode(_connection: ProviderConnection, _mode: ProviderQueueMode): Promise<void> {}

  async setAutoCompaction(): Promise<void> {}

  async respondToUiRequest(_connection: ProviderConnection, _response: ProviderUiResponse): Promise<void> {}

  async switchSession(connection: ProviderConnection, sessionRef: SessionRef): Promise<SessionSnapshot> {
    connection.sessionRef = sessionRef;
    return this.getSnapshot(connection);
  }

  async createSession(connection: ProviderConnection, _options?: NewSessionOptions): Promise<SessionSnapshot> {
    connection.sessionRef = "fake-ui-session";
    return this.getSnapshot(connection);
  }

  async getSnapshot(connection: ProviderConnection): Promise<SessionSnapshot> {
    return {
      summary: {
        providerId: this.id,
        sessionRef: connection.sessionRef ?? "fake-ui-session",
        status: "idle",
      },
      cwd: "",
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

  async sendMessage(connection: ProviderConnection): Promise<void> {
    this.emit(connection, {
      type: "extension.ui.request",
      request: {
        id: "ui-test-1",
        kind: "input",
        title: "Test",
        message: "Enter value",
      },
      occurredAt: Date.now(),
    });
  }

  subscribe(connection: ProviderConnection, onEvent: (event: SessionDomainEvent) => void): () => void {
    const listeners = this.#listeners.get(connection) ?? new Set<(event: SessionDomainEvent) => void>();
    listeners.add(onEvent);
    this.#listeners.set(connection, listeners);
    return () => listeners.delete(onEvent);
  }

  private emit(connection: ProviderConnection, event: SessionDomainEvent) {
    for (const listener of this.#listeners.get(connection) ?? []) {
      listener(event);
    }
  }
}
