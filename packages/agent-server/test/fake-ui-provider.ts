import type {
  AgentProvider,
  ConnectContext,
  ProviderCapabilities,
  ProviderConnection,
  SessionDomainEvent,
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
  ui: { model: false, thinkingLevel: false, extensionUi: true, compaction: false },
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
