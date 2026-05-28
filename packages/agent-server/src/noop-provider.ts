import type {
  AgentProvider,
  ConnectContext,
  MessageInput,
  ProviderCapabilities,
  ProviderConnection,
  SessionDomainEvent,
  SessionSnapshot,
} from "@h3code/agent-core";

const noopCapabilities: ProviderCapabilities = {
  sessions: {
    list: false,
    create: false,
    switch: false,
    snapshot: true,
    fork: false,
    import: false,
  },
  runs: {
    stream: true,
    abort: true,
    steer: false,
    followUp: false,
    retry: false,
  },
  ui: {
    model: false,
    thinkingLevel: false,
    extensionUi: false,
    compaction: false,
  },
  workspace: {
    localCwd: true,
  },
};

type NoopConnection = ProviderConnection & {
  repoPath: string;
  sessionRef: string;
};

export class NoopProvider implements AgentProvider {
  readonly id = "noop";
  readonly capabilities = noopCapabilities;

  readonly #listeners = new WeakMap<ProviderConnection, Set<(event: SessionDomainEvent) => void>>();

  async connect(ctx: ConnectContext): Promise<NoopConnection> {
    return {
      providerId: this.id,
      repoPath: ctx.repoPath,
      sessionRef: ctx.sessionRef ?? "noop-session",
    };
  }

  async disconnect(connection: ProviderConnection): Promise<void> {
    this.#listeners.delete(connection);
  }

  async sendMessage(connection: ProviderConnection, input: MessageInput): Promise<void> {
    const now = Date.now();
    this.emit(connection, { type: "run.started", occurredAt: now });
    this.emit(connection, {
      type: "message.streaming",
      phase: "end",
      message: { role: "assistant", content: `Noop provider received ${input.mode}: ${input.text}` },
      occurredAt: now,
    });
    this.emit(connection, {
      type: "run.ended",
      occurredAt: Date.now(),
    });
  }

  async abort(connection: ProviderConnection): Promise<void> {
    this.emit(connection, {
      type: "provider.diagnostic",
      level: "info",
      message: "Noop provider has no active run to abort.",
      occurredAt: Date.now(),
    });
  }

  async getSnapshot(connection: ProviderConnection): Promise<SessionSnapshot> {
    return {
      summary: {
        providerId: this.id,
        sessionRef: connection.sessionRef ?? "noop-session",
        status: "idle",
        title: "Noop session",
      },
      cwd: (connection as Partial<NoopConnection>).repoPath ?? "",
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

  subscribe(connection: ProviderConnection, onEvent: (event: SessionDomainEvent) => void): () => void {
    const listeners = this.#listeners.get(connection) ?? new Set<(event: SessionDomainEvent) => void>();
    listeners.add(onEvent);
    this.#listeners.set(connection, listeners);

    return () => {
      listeners.delete(onEvent);
    };
  }

  private emit(connection: ProviderConnection, event: SessionDomainEvent) {
    for (const listener of this.#listeners.get(connection) ?? []) {
      listener(event);
    }
  }
}
