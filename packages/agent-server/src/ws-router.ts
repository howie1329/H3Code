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
import type { PlatformService } from "./platform/platform-service.js";
import type { ProviderRegistry } from "./provider-registry.js";

const diffRefreshEvents = new Set(["run.ended", "tool.updated", "turn.completed"]);

export class WsRouter {
  readonly #diffTimers = new Map<ConnectionId, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly connections: ConnectionManager,
    private readonly platform: PlatformService,
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
          let connectionId!: ConnectionId;

          connectionId = await this.connections.connect(
            provider,
            { repoPath, sessionRef: message.sessionRef },
            (event) => this.emitSessionEvent(socket, connectionId, event),
          );

          send(socket, { type: "connection.status", connectionId, state: "connected" });
          return;
        }

        case "workspace.disconnect":
          this.clearDiffTimer(message.connectionId);
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

        case "provider.commands.list": {
          const commands = await this.connections.listCommands(message.connectionId);
          send(socket, { type: "provider.commands.list", id: message.id, commands });
          return;
        }

        case "provider.models.list": {
          const models = await this.connections.listModels(message.connectionId);
          send(socket, { type: "provider.models.list", id: message.id, models });
          return;
        }

        case "provider.queue.set": {
          if (message.steeringMode) {
            await this.connections.setSteeringMode(message.connectionId, message.steeringMode);
          }

          if (message.followUpMode) {
            await this.connections.setFollowUpMode(message.connectionId, message.followUpMode);
          }

          const snapshot = await this.connections.getSnapshot(message.connectionId);
          send(socket, { type: "provider.queue.set", id: message.id, snapshot });
          return;
        }

        case "provider.compaction.set": {
          await this.connections.setAutoCompaction(message.connectionId, message.enabled);
          const snapshot = await this.connections.getSnapshot(message.connectionId);
          send(socket, { type: "provider.compaction.set", id: message.id, snapshot });
          return;
        }

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

        case "session.delete": {
          const repoPath = requireString(message.repoPath, "repoPath");
          const sessionRef = requireString(message.sessionRef, "sessionRef");
          const sessions = await this.platform.deleteSession({
            repoPath,
            sessionRef,
            connectionId: message.connectionId,
          });
          send(socket, { type: "session.delete", id: message.id, sessions });
          return;
        }

        case "workspace.diff": {
          const diff = await this.platform.getWorkspaceDiff(message.connectionId);
          send(socket, { type: "workspace.diff", id: message.id, connectionId: message.connectionId, diff });
          return;
        }

        case "session.list": {
          const repoPath = requireString(message.repoPath, "repoPath");
          const sessions = await this.platform.listSessions({
            repoPath,
            providerId: message.providerId,
            markRecent: message.markRecent,
          });
          send(socket, { type: "session.list", id: message.id, sessions });
          return;
        }

        case "preferences.get": {
          send(socket, {
            type: "preferences.snapshot",
            id: message.id,
            preferences: this.platform.getPreferences(),
          });
          return;
        }

        case "preferences.updateDesktopSettings": {
          const preferences = this.platform.updateDesktopSettings(message.settings);
          send(socket, { type: "preferences.snapshot", id: message.id, preferences });
          return;
        }

        case "preferences.setPiExecutablePath": {
          const preferences = this.platform.setPiExecutablePath(message.path);
          send(socket, { type: "preferences.snapshot", id: message.id, preferences });
          return;
        }

        case "preferences.removeRepo": {
          const repoPath = requireString(message.repoPath, "repoPath");
          const preferences = await this.platform.removeRepo(repoPath);
          send(socket, { type: "preferences.snapshot", id: message.id, preferences });
          return;
        }

        case "preferences.clearIndexed": {
          const preferences = this.platform.clearIndexed();
          send(socket, { type: "preferences.snapshot", id: message.id, preferences });
          return;
        }

        case "session.cache.get": {
          const sessionRef = requireString(message.sessionRef, "sessionRef");
          const entry = this.platform.getSessionMessageCache(sessionRef);
          send(socket, { type: "session.cache.entry", id: message.id, entry });
          return;
        }

        case "session.cache.upsert": {
          this.platform.upsertSessionMessageCache(message.entry);
          send(socket, { type: "session.cache.saved", id: message.id });
          return;
        }

        case "session.cache.delete": {
          const sessionRef = requireString(message.sessionRef, "sessionRef");
          this.platform.deleteSessionMessageCache(sessionRef);
          send(socket, { type: "session.cache.deleted", id: message.id });
          return;
        }

        default:
          assertNever(message);
      }
    } catch (error) {
      send(socket, errorMessage(error, message.id));
    }
  }

  private emitSessionEvent(socket: WebSocket, connectionId: ConnectionId, event: SessionDomainEvent) {
    if (event.type === "extension.ui.request") {
      send(socket, { type: "provider.ui.request", connectionId, request: event.request });
      return;
    }

    send(socket, { type: "session.event", connectionId, event });

    if (diffRefreshEvents.has(event.type)) {
      this.scheduleDiffPush(socket, connectionId);
    }
  }

  private scheduleDiffPush(socket: WebSocket, connectionId: ConnectionId) {
    const existing = this.#diffTimers.get(connectionId);

    if (existing) {
      clearTimeout(existing);
    }

    this.#diffTimers.set(
      connectionId,
      setTimeout(() => {
        this.#diffTimers.delete(connectionId);
        void this.pushDiff(socket, connectionId);
      }, 300),
    );
  }

  private clearDiffTimer(connectionId: ConnectionId) {
    const existing = this.#diffTimers.get(connectionId);

    if (existing) {
      clearTimeout(existing);
      this.#diffTimers.delete(connectionId);
    }
  }

  private async pushDiff(socket: WebSocket, connectionId: ConnectionId) {
    try {
      const diff = await this.platform.getWorkspaceDiff(connectionId);
      send(socket, { type: "workspace.diff", connectionId, diff });
    } catch {
      // Diff refresh is best-effort for push updates.
    }
  }
}

export function send(socket: WebSocket, message: ServerToClientMessage) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function assertNever(value: never): never {
  throw new AgentServerError("unknown_command", `Unhandled command: ${JSON.stringify(value)}`);
}

function isRequestLike(error: unknown): error is { requestId?: string } {
  return typeof error === "object" && error !== null && "requestId" in error;
}
