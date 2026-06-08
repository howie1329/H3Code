import {
  AGENT_PROTOCOL_VERSION,
  type ClientToServerMessage,
  type DeleteSessionInput,
  type ListSessionsInput,
  type RuntimeBinding,
  type ServerToClientMessage,
  type SessionReadModel,
  type SessionSummary,
} from "@h3code/agent-protocol";
import type { AgentRuntime } from "@h3code/agent-runtime";
import { toProtocolError } from "./errors.js";

export type RuntimeWsPeer = {
  send(message: ServerToClientMessage): void;
};

/**
 * Workspace platform services owned by the Agent Server (e.g. local session
 * indexing). Kept separate from the runtime read-model projector so the
 * transport can answer "what sessions exist for this repo?" without provider
 * knowledge leaking into the runtime or UI.
 */
export type WorkspaceService = {
  listSessions(input: ListSessionsInput): Promise<SessionSummary[]>;
  deleteSession?(input: DeleteSessionInput): Promise<SessionSummary[]>;
  assertRegisteredSession?(sessionId: string): void | Promise<void>;
  registerSession?(session: SessionReadModel, binding: RuntimeBinding): void | Promise<void>;
  touchSession?(sessionId: string): void | Promise<void>;
};

export class AgentRuntimeWsMessageRouter {
  readonly #runtime: AgentRuntime;
  readonly #workspace: WorkspaceService | undefined;
  readonly #subscriptions = new Map<RuntimeWsPeer, Map<string, () => void>>();

  constructor(runtime: AgentRuntime, workspace?: WorkspaceService) {
    this.#runtime = runtime;
    this.#workspace = workspace;
  }

  async route(peer: RuntimeWsPeer, message: ClientToServerMessage): Promise<void> {
    try {
      switch (message.type) {
        case "command":
          if (message.payload.type === "session.delete") {
            await this.#workspace?.assertRegisteredSession?.(message.payload.sessionId);

            if (!this.#workspace?.deleteSession) {
              throw Object.assign(new Error("Workspace session deletion is not available."), { code: "unsupported_message" });
            }

            const sessions = await this.#workspace.deleteSession({
              repoPath: message.payload.repoPath,
              providerId: message.payload.providerId,
              sessionId: message.payload.sessionId,
            });
            await this.#runtime.dispatchCommand(message.payload);
            peer.send({
              type: "command.result",
              protocolVersion: AGENT_PROTOCOL_VERSION,
              payload: { requestId: message.id, sessions },
              sentAt: Date.now(),
            });
            return;
          }

          if (message.payload.type === "session.switch") {
            await this.#workspace?.assertRegisteredSession?.(message.payload.sessionId);
          }

          const result = await this.#runtime.dispatchCommand(message.payload);

          if (message.payload.type === "session.create" && result && "id" in result) {
            const binding = this.#runtime.getBinding(result.id);
            if (binding) {
              try {
                await this.#workspace?.registerSession?.(result, binding);
              } catch (error) {
                await this.#runtime.removeSession(result.id);
                throw error;
              }
            }
          }

          if (message.payload.type === "session.switch" && result && "id" in result) {
            await this.#workspace?.touchSession?.(result.id);
          }

          peer.send({
            type: "command.result",
            protocolVersion: AGENT_PROTOCOL_VERSION,
            payload: toCommandResultPayload(message.id, result),
            sentAt: Date.now(),
          });
          return;
        case "session.subscribe": {
          const unsubscribe = this.#runtime.subscribe(message.payload.sessionId, (event) => {
            peer.send({ type: "session.event", protocolVersion: AGENT_PROTOCOL_VERSION, payload: event, sentAt: Date.now() });
          });
          const peerSubscriptions = this.#subscriptions.get(peer) ?? new Map<string, () => void>();
          peerSubscriptions.get(message.payload.sessionId)?.();
          peerSubscriptions.set(message.payload.sessionId, unsubscribe);
          this.#subscriptions.set(peer, peerSubscriptions);
          return;
        }
        case "session.unsubscribe":
          this.#subscriptions.get(peer)?.get(message.payload.sessionId)?.();
          this.#subscriptions.get(peer)?.delete(message.payload.sessionId);
          return;
        case "session.snapshot.request": {
          const session = this.#runtime.getSnapshot(message.payload.sessionId);
          if (!session) throw Object.assign(new Error(`Session not found: ${message.payload.sessionId}`), { code: "session_not_found" });
          peer.send({ type: "session.snapshot.response", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { requestId: message.id, session }, sentAt: Date.now() });
          return;
        }
        case "session.list.request": {
          if (!this.#workspace) {
            throw Object.assign(new Error("Workspace session listing is not available."), { code: "unsupported_message" });
          }
          const sessions = await this.#workspace.listSessions(message.payload);
          peer.send({ type: "session.list.response", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { requestId: message.id, sessions }, sentAt: Date.now() });
          return;
        }
        default:
          throw Object.assign(new Error(`Unsupported message type: ${(message as { type?: string }).type ?? "unknown"}`), { code: "unsupported_message" });
      }
    } catch (error) {
      peer.send({ type: "error", protocolVersion: AGENT_PROTOCOL_VERSION, payload: toProtocolError(error, message.id), sentAt: Date.now() });
    }
  }

  disconnect(peer: RuntimeWsPeer): void {
    for (const unsubscribe of this.#subscriptions.get(peer)?.values() ?? []) unsubscribe();
    this.#subscriptions.delete(peer);
  }
}

function toCommandResultPayload(requestId: string | undefined, result: Awaited<ReturnType<AgentRuntime["dispatchCommand"]>>) {
  if (result && "commands" in result) {
    return { requestId, providerCommands: { commands: result.commands } };
  }

  if (result && "models" in result) {
    return { requestId, providerModels: { models: result.models } };
  }

  if (result) {
    return { requestId, session: result };
  }

  return { requestId };
}
