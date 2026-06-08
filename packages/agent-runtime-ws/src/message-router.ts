import { AGENT_PROTOCOL_VERSION, type ClientToServerMessage, type ServerToClientMessage } from "@h3code/agent-protocol";
import type { AgentRuntime } from "@h3code/agent-runtime";
import { toProtocolError } from "./errors.js";

export type RuntimeWsPeer = {
  send(message: ServerToClientMessage): void;
};

export class AgentRuntimeWsMessageRouter {
  readonly #runtime: AgentRuntime;
  readonly #subscriptions = new Map<RuntimeWsPeer, Map<string, () => void>>();

  constructor(runtime: AgentRuntime) {
    this.#runtime = runtime;
  }

  async route(peer: RuntimeWsPeer, message: ClientToServerMessage): Promise<void> {
    try {
      switch (message.type) {
        case "command":
          const session = await this.#runtime.dispatchCommand(message.payload);
          peer.send({
            type: "command.result",
            protocolVersion: AGENT_PROTOCOL_VERSION,
            payload: session ? { requestId: message.id, session } : { requestId: message.id },
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
