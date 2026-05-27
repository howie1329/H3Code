import { randomUUID } from "node:crypto";
import type {
  AgentProvider,
  ConnectionId,
  ConnectContext,
  MessageInput,
  ProviderConnection,
  RunRef,
  SessionDomainEvent,
  SessionRef,
} from "@h3code/agent-core";
import { AgentServerError } from "./errors.js";

type ManagedConnection = {
  provider: AgentProvider;
  connection: ProviderConnection;
  unsubscribe: () => void;
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

    this.#connections.set(connectionId, { provider, connection, unsubscribe });
    return connectionId;
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

  private require(connectionId: ConnectionId) {
    const managed = this.#connections.get(connectionId);

    if (!managed) {
      throw new AgentServerError("connection_not_found", `Unknown connection: ${connectionId}`);
    }

    return managed;
  }
}
