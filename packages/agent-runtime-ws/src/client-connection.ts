import type { ClientToServerMessage, ServerToClientMessage } from "@h3code/agent-protocol";
import type { WebSocket } from "ws";
import type { AgentRuntimeWsMessageRouter, RuntimeWsPeer } from "./message-router.js";
import { AGENT_PROTOCOL_VERSION } from "@h3code/agent-protocol";

export class AgentRuntimeWsClientConnection implements RuntimeWsPeer {
  constructor(
    private readonly socket: WebSocket,
    private readonly router: AgentRuntimeWsMessageRouter,
  ) {
    socket.on("message", (data) => void this.handleRawMessage(data.toString()));
    socket.on("close", () => this.router.disconnect(this));
  }

  send(message: ServerToClientMessage): void {
    if (this.socket.readyState === this.socket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private async handleRawMessage(raw: string): Promise<void> {
    try {
      await this.router.route(this, JSON.parse(raw) as ClientToServerMessage);
    } catch (error) {
      this.send({ type: "error", protocolVersion: AGENT_PROTOCOL_VERSION, payload: { code: "invalid_message", message: error instanceof Error ? error.message : "Invalid message" }, sentAt: Date.now() });
    }
  }
}
