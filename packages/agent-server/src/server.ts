import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import { AGENT_CORE_PROTOCOL_VERSION, type AgentProvider } from "@h3code/agent-core";
import { ConnectionManager } from "./connection-manager.js";
import { ProviderRegistry } from "./provider-registry.js";
import { send, WsRouter } from "./ws-router.js";

export interface AgentServerOptions {
  host?: string;
  port?: number;
  providers: AgentProvider[];
}

export interface AgentServerHandle {
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
}

export async function startAgentServer(options: AgentServerOptions): Promise<AgentServerHandle> {
  if (!options.providers?.length) {
    throw new Error("startAgentServer requires at least one provider in options.providers");
  }

  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const httpServer = createHttpServer();
  const wsServer = new WebSocketServer({ noServer: true });
  const registry = new ProviderRegistry();
  const connections = new ConnectionManager();
  const router = new WsRouter(registry, connections);

  for (const provider of options.providers) {
    registry.register(provider);
  }

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") {
      socket.destroy();
      return;
    }

    wsServer.handleUpgrade(request, socket, head, (webSocket) => {
      wsServer.emit("connection", webSocket, request);
    });
  });

  wsServer.on("connection", (socket) => {
    send(socket, {
      type: "server.ready",
      protocolVersion: AGENT_CORE_PROTOCOL_VERSION,
      providers: registry.descriptors(),
    });

    socket.on("message", (data) => {
      void router.handle(socket, data);
    });

    socket.on("close", () => {
      void connections.disconnectAll();
    });
  });

  await listen(httpServer, port, host);

  const address = httpServer.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;

  return {
    host,
    port: resolvedPort,
    url: `ws://${host}:${resolvedPort}/ws`,
    close: async () => {
      await connections.disconnectAll();
      await closeWebSocketServer(wsServer);
      await closeHttpServer(httpServer);
    },
  };
}

function createHttpServer() {
  return createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404);
    response.end();
  });
}

function listen(server: Server, port: number, host: string) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeHttpServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function closeWebSocketServer(server: WebSocketServer) {
  return new Promise<void>((resolve, reject) => {
    for (const client of server.clients) {
      client.terminate();
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
