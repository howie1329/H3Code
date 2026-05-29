import { randomUUID } from "node:crypto";
import { AgentServerError } from "./errors.js";
export class ConnectionManager {
    #connections = new Map();
    async connect(provider, ctx, onEvent) {
        const connection = await provider.connect(ctx);
        const unsubscribe = provider.subscribe(connection, onEvent);
        const connectionId = `conn-${randomUUID()}`;
        this.#connections.set(connectionId, { provider, connection, unsubscribe, repoPath: ctx.repoPath });
        return connectionId;
    }
    getLiveSessionConnections(repoPath) {
        const live = new Map();
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
    async listCommands(connectionId) {
        const managed = this.require(connectionId);
        if (!managed.provider.listCommands) {
            throw new AgentServerError("unsupported_command", "Provider does not support command listing.");
        }
        return managed.provider.listCommands(managed.connection);
    }
    async listModels(connectionId) {
        const managed = this.require(connectionId);
        if (!managed.provider.listModels) {
            throw new AgentServerError("unsupported_command", "Provider does not support model listing.");
        }
        return managed.provider.listModels(managed.connection);
    }
    async setSteeringMode(connectionId, mode) {
        const managed = this.require(connectionId);
        if (!managed.provider.setSteeringMode) {
            throw new AgentServerError("unsupported_command", "Provider does not support steering mode changes.");
        }
        await managed.provider.setSteeringMode(managed.connection, mode);
    }
    async setFollowUpMode(connectionId, mode) {
        const managed = this.require(connectionId);
        if (!managed.provider.setFollowUpMode) {
            throw new AgentServerError("unsupported_command", "Provider does not support follow-up mode changes.");
        }
        await managed.provider.setFollowUpMode(managed.connection, mode);
    }
    async setAutoCompaction(connectionId, enabled) {
        const managed = this.require(connectionId);
        if (!managed.provider.setAutoCompaction) {
            throw new AgentServerError("unsupported_command", "Provider does not support compaction settings.");
        }
        await managed.provider.setAutoCompaction(managed.connection, enabled);
    }
    getRepoPath(connectionId) {
        return this.require(connectionId).repoPath;
    }
    findConnectionIdForSession(sessionRef) {
        for (const [connectionId, managed] of this.#connections) {
            if (managed.connection.sessionRef === sessionRef) {
                return connectionId;
            }
        }
        return undefined;
    }
    async disconnectForRepo(repoPath) {
        const targets = [...this.#connections.entries()].filter(([, managed]) => managed.repoPath === repoPath);
        await Promise.all(targets.map(([connectionId]) => this.disconnect(connectionId)));
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