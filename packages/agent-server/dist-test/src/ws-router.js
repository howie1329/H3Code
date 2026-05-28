import { AgentServerError, errorMessage } from "./errors.js";
import { parseClientMessage, requireString } from "./message-guards.js";
export class WsRouter {
    registry;
    connections;
    constructor(registry, connections) {
        this.registry = registry;
        this.connections = connections;
    }
    async handle(socket, data) {
        let message;
        try {
            message = parseClientMessage(data);
            await this.route(socket, message);
        }
        catch (error) {
            send(socket, errorMessage(error, isRequestLike(error) ? error.requestId : undefined));
        }
    }
    async route(socket, message) {
        try {
            switch (message.type) {
                case "workspace.connect": {
                    const provider = this.registry.get(message.providerId);
                    if (!provider) {
                        throw new AgentServerError("provider_not_found", `Unknown provider: ${message.providerId}`, message.id);
                    }
                    const repoPath = requireString(message.repoPath, "repoPath");
                    const connectionId = await this.connections.connect(provider, { repoPath, sessionRef: message.sessionRef }, (event) => emitProviderEvent(socket, connectionId, event));
                    send(socket, { type: "connection.status", connectionId, state: "connected" });
                    return;
                }
                case "workspace.disconnect":
                    await this.connections.disconnect(message.connectionId);
                    send(socket, { type: "connection.status", connectionId: message.connectionId, state: "disconnected" });
                    return;
                case "session.snapshot": {
                    const snapshot = await this.connections.getSnapshot(message.connectionId);
                    send(socket, { type: "session.snapshot", connectionId: message.connectionId, snapshot });
                    return;
                }
                case "message.send":
                    await this.connections.sendMessage(message.connectionId, { text: message.text, mode: message.mode });
                    return;
                case "run.abort":
                    await this.connections.abort(message.connectionId, message.runRef);
                    return;
                case "provider.model.set":
                    await this.connections.setModel(message.connectionId, message.model);
                    return;
                case "provider.thinking.set":
                    await this.connections.setThinkingLevel(message.connectionId, message.level);
                    return;
                case "provider.ui.respond":
                    await this.connections.respondToUiRequest(message.connectionId, message.response);
                    return;
                case "session.switch": {
                    const snapshot = await this.connections.switchSession(message.connectionId, message.sessionRef);
                    send(socket, { type: "session.snapshot", connectionId: message.connectionId, snapshot });
                    return;
                }
                case "session.create": {
                    const snapshot = await this.connections.createSession(message.connectionId, message.options);
                    send(socket, { type: "session.snapshot", connectionId: message.connectionId, snapshot });
                    return;
                }
                case "session.list":
                    throw new AgentServerError("unsupported_command", `${message.type} is not implemented yet.`, message.id);
                default:
                    assertNever(message);
            }
        }
        catch (error) {
            send(socket, errorMessage(error, message.id));
        }
    }
}
export function send(socket, message) {
    if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}
function emitProviderEvent(socket, connectionId, event) {
    if (event.type === "extension.ui.request") {
        send(socket, { type: "provider.ui.request", connectionId, request: event.request });
        return;
    }
    send(socket, { type: "session.event", connectionId, event });
}
function assertNever(value) {
    throw new AgentServerError("unknown_command", `Unhandled command: ${JSON.stringify(value)}`);
}
function isRequestLike(error) {
    return typeof error === "object" && error !== null && "requestId" in error;
}
//# sourceMappingURL=ws-router.js.map