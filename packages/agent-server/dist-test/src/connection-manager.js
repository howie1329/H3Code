import { randomUUID } from "node:crypto";
import { AgentServerError } from "./errors.js";
export class ConnectionManager {
    #connections = new Map();
    async connect(provider, ctx, onEvent) {
        const connection = await provider.connect(ctx);
        const unsubscribe = provider.subscribe(connection, onEvent);
        const connectionId = `conn-${randomUUID()}`;
        this.#connections.set(connectionId, { provider, connection, unsubscribe });
        return connectionId;
    }
    async disconnect(connectionId) {
        const managed = this.require(connectionId);
        this.#connections.delete(connectionId);
        managed.unsubscribe();
        await managed.provider.disconnect(managed.connection);
    }
    async disconnectAll() {
        await Promise.all([...this.#connections.keys()].map((connectionId) => this.disconnect(connectionId)));
    }
    async sendMessage(connectionId, input) {
        const managed = this.require(connectionId);
        await managed.provider.sendMessage(managed.connection, input);
    }
    async abort(connectionId, runRef) {
        const managed = this.require(connectionId);
        await managed.provider.abort(managed.connection, runRef);
    }
    async respondToUiRequest(connectionId, response) {
        const managed = this.require(connectionId);
        if (!managed.provider.respondToUiRequest) {
            throw new AgentServerError("unsupported_command", "Provider does not support UI responses.");
        }
        await managed.provider.respondToUiRequest(managed.connection, response);
    }
    async setModel(connectionId, model) {
        const managed = this.require(connectionId);
        if (!managed.provider.setModel) {
            throw new AgentServerError("unsupported_command", "Provider does not support model changes.");
        }
        await managed.provider.setModel(managed.connection, model);
    }
    async setThinkingLevel(connectionId, level) {
        const managed = this.require(connectionId);
        if (!managed.provider.setThinkingLevel) {
            throw new AgentServerError("unsupported_command", "Provider does not support thinking level changes.");
        }
        await managed.provider.setThinkingLevel(managed.connection, level);
    }
    async getSnapshot(connectionId) {
        const managed = this.require(connectionId);
        if (!managed.provider.getSnapshot) {
            throw new AgentServerError("unsupported_command", "Provider does not support session snapshots.");
        }
        return managed.provider.getSnapshot(managed.connection);
    }
    async switchSession(connectionId, sessionRef) {
        const managed = this.require(connectionId);
        if (!managed.provider.switchSession) {
            throw new AgentServerError("unsupported_command", "Provider does not support switching sessions.");
        }
        return managed.provider.switchSession(managed.connection, sessionRef);
    }
    async createSession(connectionId, options) {
        const managed = this.require(connectionId);
        if (!managed.provider.createSession) {
            throw new AgentServerError("unsupported_command", "Provider does not support creating sessions.");
        }
        return managed.provider.createSession(managed.connection, options);
    }
    require(connectionId) {
        const managed = this.#connections.get(connectionId);
        if (!managed) {
            throw new AgentServerError("connection_not_found", `Unknown connection: ${connectionId}`);
        }
        return managed;
    }
}
//# sourceMappingURL=connection-manager.js.map