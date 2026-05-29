import type {
  AgentProvider,
  ConnectContext,
  ProviderCapabilities,
  ProviderCommand,
  ProviderConnection,
  ProviderModel,
  ProviderQueueMode,
  SessionDomainEvent,
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

  subscribe(_connection: ProviderConnection, _onEvent: (event: SessionDomainEvent) => void): () => void {
    return () => {};
  }

  async getSnapshot(connection: ProviderConnection): Promise<SessionSnapshot> {
    return {
      summary: {
        providerId: this.id,
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
