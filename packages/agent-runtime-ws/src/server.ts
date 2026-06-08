import type { AgentRuntime } from "@h3code/agent-runtime";
import { WebSocketServer, type ServerOptions } from "ws";
import { AgentRuntimeWsClientConnection } from "./client-connection.js";
import { AgentRuntimeWsMessageRouter } from "./message-router.js";

export type AgentRuntimeWsServerOptions = ServerOptions & {
  runtime: AgentRuntime;
};

export function createAgentRuntimeWsServer(options: AgentRuntimeWsServerOptions): WebSocketServer {
  const { runtime, ...serverOptions } = options;
  const server = new WebSocketServer(serverOptions);
  const router = new AgentRuntimeWsMessageRouter(runtime);
  server.on("connection", (socket) => {
    new AgentRuntimeWsClientConnection(socket, router);
  });
  return server;
}
