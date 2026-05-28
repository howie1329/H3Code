import type {
  ClientToServerMessage,
  ConnectionId,
  ServerToClientMessage,
  SessionDomainEvent,
} from "@h3code/agent-core";
import type { RawData, WebSocket } from "ws";
import { AgentServerError, errorMessage } from "./errors.js";
import { parseClientMessage, requireString } from "./message-guards.js";
import type { ConnectionManager } from "./connection-manager.js";
import type { ProviderRegistry } from "./provider-registry.js";

export class WsRouter {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly connections: ConnectionManager,
  ) {}

  async handle(socket: WebSocket, data: RawData) {
    let message: ClientToServerMessage;

    try {
      message = parseClientMessage(data);
      await this.route(socket, message);
    } catch (error) {
      send(socket, errorMessage(error, isRequestLike(error) ? error.requestId : undefined));
    }
  }

  private async route(socket: WebSocket, message: ClientToServerMessage) {
    try {
      switch (message.type) {
        case "workspace.connect": {
          const provider = this.registry.get(message.providerId);

          if (!provider) {
            throw new AgentServerError("provider_not_found", `Unknown provider: ${message.providerId}`, message.id);
          }

          const repoPath = requireString(message.repoPath, "repoPath");
          const connectionId = await this.connections.connect(
            provider,
            { repoPath, sessionRef: message.sessionRef },
            (event) => emitProviderEvent(socket, connectionId, event),
          );

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
    } catch (error) {
      send(socket, errorMessage(error, message.id));
    }
  }
}

export function send(socket: WebSocket, message: ServerToClientMessage) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function emitProviderEvent(socket: WebSocket, connectionId: ConnectionId, event: SessionDomainEvent) {
  if (event.type === "extension.ui.request") {
    send(socket, { type: "provider.ui.request", connectionId, request: event.request });
    return;
  }

  send(socket, { type: "session.event", connectionId, event });
}

function assertNever(value: never): never {
  throw new AgentServerError("unknown_command", `Unhandled command: ${JSON.stringify(value)}`);
}

function isRequestLike(error: unknown): error is { requestId?: string } {
  return typeof error === "object" && error !== null && "requestId" in error;
}
