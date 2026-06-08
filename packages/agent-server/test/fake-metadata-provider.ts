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

const metadataCapabilities: ProviderCapabilities = {
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
    extensionUi: false,
    compaction: true,
    commands: true,
    modelsList: true,
    queueSettings: true,
  },
  workspace: { localCwd: true },
};

const sampleCommands: ProviderCommand[] = [{ name: "help", description: "Help", source: "extension" }];
const sampleModels: ProviderModel[] = [{ id: "gpt-test", provider: "openai", name: "Test" }];

export class FakeMetadataProvider implements AgentProvider {
  readonly id = "fake-metadata";
  readonly capabilities = metadataCapabilities;

  steeringMode: ProviderQueueMode = "one-at-a-time";
  followUpMode: ProviderQueueMode = "one-at-a-time";
  autoCompactionEnabled = true;

  async connect(ctx: ConnectContext): Promise<ProviderConnection> {
    return { providerId: this.id, sessionRef: ctx.sessionRef ?? "fake-metadata-session" };
  }

  async disconnect(_connection: ProviderConnection): Promise<void> {}

  async abort(_connection: ProviderConnection): Promise<void> {}

  async sendMessage(_connection: ProviderConnection): Promise<void> {}

  async setModel(_connection: ProviderConnection, _model: unknown): Promise<void> {}

  async setThinkingLevel(_connection: ProviderConnection, _level: string): Promise<void> {}

  async respondToUiRequest(_connection: ProviderConnection, _response: ProviderUiResponse): Promise<void> {}

  async switchSession(connection: ProviderConnection, sessionRef: SessionRef): Promise<SessionSnapshot> {
    connection.sessionRef = sessionRef;
    return this.getSnapshot(connection);
  }

  async createSession(connection: ProviderConnection, _options?: NewSessionOptions): Promise<SessionSnapshot> {
    connection.sessionRef = "fake-metadata-session";
    return this.getSnapshot(connection);
  }

  subscribe(_connection: ProviderConnection, _onEvent: (event: SessionDomainEvent) => void): () => void {
    return () => {};
  }

  async getSnapshot(connection: ProviderConnection): Promise<SessionSnapshot> {
    return {
      summary: {
        id: connection.sessionRef ?? "fake-metadata-session",
        providerId: this.id,
        providerSessionRef: connection.sessionRef ?? "fake-metadata-session",
        sessionRef: connection.sessionRef ?? "fake-metadata-session",
        status: "idle",
        title: "Metadata test session",
      },
      cwd: "",
      messages: [],
      isStreaming: false,
      isCompacting: false,
      steering: [],
      followUp: [],
      steeringMode: this.steeringMode,
      followUpMode: this.followUpMode,
      autoCompactionEnabled: this.autoCompactionEnabled,
      activeTools: [],
      tools: [],
      diagnostics: [],
    };
  }

  async listCommands(): Promise<ProviderCommand[]> {
    return sampleCommands;
  }

  async listModels(): Promise<ProviderModel[]> {
    return sampleModels;
  }

  async setSteeringMode(_connection: ProviderConnection, mode: ProviderQueueMode): Promise<void> {
    this.steeringMode = mode;
  }

  async setFollowUpMode(_connection: ProviderConnection, mode: ProviderQueueMode): Promise<void> {
    this.followUpMode = mode;
  }

  async setAutoCompaction(_connection: ProviderConnection, enabled: boolean): Promise<void> {
    this.autoCompactionEnabled = enabled;
  }
}
