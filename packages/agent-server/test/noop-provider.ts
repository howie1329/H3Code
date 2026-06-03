import type {
  AgentProvider,
  ConnectContext,
  MessageInput,
  ProviderCapabilities,
  ProviderCommand,
  ProviderConnection,
  ProviderModel,
  ProviderQueueMode,
  ProviderUiResponse,
  NewSessionOptions,
  SessionDomainEvent,
  SessionSnapshot,
  SessionRef,
} from "@h3code/agent-core";
import { AgentServerError } from "../src/errors.js";

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
    commands: false,
    modelsList: false,
    queueSettings: false,
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

  async setModel(): Promise<void> {
    throw unsupported("Noop provider does not support model changes.");
  }

  async setThinkingLevel(): Promise<void> {
    throw unsupported("Noop provider does not support thinking level changes.");
  }

  async listCommands(): Promise<ProviderCommand[]> {
    throw unsupported("Noop provider does not support command listing.");
  }

  async listModels(): Promise<ProviderModel[]> {
    throw unsupported("Noop provider does not support model listing.");
  }

  async setSteeringMode(_connection: ProviderConnection, _mode: ProviderQueueMode): Promise<void> {
    throw unsupported("Noop provider does not support steering mode changes.");
  }

  async setFollowUpMode(_connection: ProviderConnection, _mode: ProviderQueueMode): Promise<void> {
    throw unsupported("Noop provider does not support follow-up mode changes.");
  }

  async setAutoCompaction(): Promise<void> {
    throw unsupported("Noop provider does not support compaction settings.");
  }

  async respondToUiRequest(_connection: ProviderConnection, _response: ProviderUiResponse): Promise<void> {
    throw unsupported("Noop provider does not support UI responses.");
  }

  async switchSession(_connection: ProviderConnection, _sessionRef: SessionRef): Promise<SessionSnapshot> {
    throw unsupported("Noop provider does not support switching sessions.");
  }

  async createSession(_connection: ProviderConnection, _options?: NewSessionOptions): Promise<SessionSnapshot> {
    throw unsupported("Noop provider does not support creating sessions.");
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

function unsupported(message: string) {
  return new AgentServerError("unsupported_command", message);
}
