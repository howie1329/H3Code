import { randomUUID } from "node:crypto";
import type {
  AgentProvider,
  ConnectionId,
  ConnectContext,
  MessageInput,
  ProviderConnection,
  ProviderUiResponse,
  RunRef,
  SessionDomainEvent,
  SessionRef,
  NewSessionOptions,
} from "@h3code/agent-core";
import { AgentServerError } from "./errors.js";

type ManagedConnection = {
  provider: AgentProvider;
  connection: ProviderConnection;
  unsubscribe: () => void;
  repoPath: string;
};

export class ConnectionManager {
  readonly #connections = new Map<ConnectionId, ManagedConnection>();

  async connect(
    provider: AgentProvider,
    ctx: ConnectContext,
    onEvent: (event: SessionDomainEvent) => void,
  ): Promise<ConnectionId> {
    const connection = await provider.connect(ctx);
    const unsubscribe = provider.subscribe(connection, onEvent);
    const connectionId = `conn-${randomUUID()}`;

    this.#connections.set(connectionId, { provider, connection, unsubscribe, repoPath: ctx.repoPath });
    return connectionId;
  }

  getLiveSessionConnections(repoPath: string): Map<string, ConnectionId> {
    const live = new Map<string, ConnectionId>();

    for (const [connectionId, managed] of this.#connections) {
      if (managed.repoPath !== repoPath) {
        continue;
      }

      const sessionRef = managed.connection.sessionRef;

      if (sessionRef) {
        live.set(sessionRef, connectionId);
      }
    }

    return live;
  }

  async disconnect(connectionId: ConnectionId) {
    const managed = this.require(connectionId);
    this.#connections.delete(connectionId);
    managed.unsubscribe();
    await managed.provider.disconnect(managed.connection);
  }

  async disconnectAll() {
    await Promise.all([...this.#connections.keys()].map((connectionId) => this.disconnect(connectionId)));
  }

  async sendMessage(connectionId: ConnectionId, input: MessageInput) {
    const managed = this.require(connectionId);
    await managed.provider.sendMessage(managed.connection, input);
  }

  async abort(connectionId: ConnectionId, runRef?: RunRef) {
    const managed = this.require(connectionId);
    await managed.provider.abort(managed.connection, runRef);
  }

  async respondToUiRequest(connectionId: ConnectionId, response: ProviderUiResponse) {
    const managed = this.require(connectionId);

    if (!managed.provider.respondToUiRequest) {
      throw new AgentServerError("unsupported_command", "Provider does not support UI responses.");
    }

    await managed.provider.respondToUiRequest(managed.connection, response);
  }

  async setModel(connectionId: ConnectionId, model: unknown) {
    const managed = this.require(connectionId);

    if (!managed.provider.setModel) {
      throw new AgentServerError("unsupported_command", "Provider does not support model changes.");
    }

    await managed.provider.setModel(managed.connection, model);
  }

  async setThinkingLevel(connectionId: ConnectionId, level: string) {
    const managed = this.require(connectionId);

    if (!managed.provider.setThinkingLevel) {
      throw new AgentServerError("unsupported_command", "Provider does not support thinking level changes.");
    }

    await managed.provider.setThinkingLevel(managed.connection, level);
  }

  async getSnapshot(connectionId: ConnectionId) {
    const managed = this.require(connectionId);

    if (!managed.provider.getSnapshot) {
      throw new AgentServerError("unsupported_command", "Provider does not support session snapshots.");
    }

    return managed.provider.getSnapshot(managed.connection);
  }

  async switchSession(connectionId: ConnectionId, sessionRef: SessionRef) {
    const managed = this.require(connectionId);

    if (!managed.provider.switchSession) {
      throw new AgentServerError("unsupported_command", "Provider does not support switching sessions.");
    }

    return managed.provider.switchSession(managed.connection, sessionRef);
  }

  async createSession(connectionId: ConnectionId, options?: NewSessionOptions) {
    const managed = this.require(connectionId);

    if (!managed.provider.createSession) {
      throw new AgentServerError("unsupported_command", "Provider does not support creating sessions.");
    }

    return managed.provider.createSession(managed.connection, options);
  }

  private require(connectionId: ConnectionId) {
    const managed = this.#connections.get(connectionId);

    if (!managed) {
      throw new AgentServerError("connection_not_found", `Unknown connection: ${connectionId}`);
    }

    return managed;
  }
}
