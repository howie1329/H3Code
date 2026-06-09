import type { AgentRuntime } from "@h3code/agent-runtime";
import { WebSocketServer, type ServerOptions } from "ws";
import { AgentRuntimeWsClientConnection } from "./client-connection.js";
import { AgentRuntimeWsMessageRouter, type WorkspaceService } from "./message-router.js";

export type AgentRuntimeWsServerOptions = ServerOptions & {
  runtime: AgentRuntime;
  workspace?: WorkspaceService;
};

export function createAgentRuntimeWsServer(options: AgentRuntimeWsServerOptions): WebSocketServer {
  const { runtime, workspace, ...serverOptions } = options;
  const server = new WebSocketServer(serverOptions);
  const router = new AgentRuntimeWsMessageRouter(runtime, workspace);
  server.on("connection", (socket) => {
    new AgentRuntimeWsClientConnection(socket, router);
  });
  return server;
}
