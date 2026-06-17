import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import {
  handleHarnessAbortRequest,
  handleHarnessChatRequest,
  handleHarnessHealthRequest,
} from "./harness-chat-handler.js";
import type { HarnessSessionManager } from "./harness-session-manager.js";

const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "null",
]);

function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;

  if (origin && (allowedOrigins.has(origin) || origin.startsWith("http://127.0.0.1:"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  return true;
}

function writeMethodNotAllowed(res: ServerResponse) {
  res.statusCode = 405;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Method not allowed." }));
}

export type HarnessHttpServer = {
  server: Server;
  port: number;
  chatUrl: string;
  close: () => Promise<void>;
};

export async function createHarnessHttpServer(
  sessionManager: HarnessSessionManager,
  options: { host?: string } = {},
): Promise<HarnessHttpServer> {
  const host = options.host ?? "127.0.0.1";

  const server = createServer((req, res) => {
    void routeHarnessRequest(req, res, sessionManager);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve harness HTTP server port.");
  }

  const chatUrl = `http://${host}:${address.port}/api/chat`;

  return {
    server,
    port: address.port,
    chatUrl,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

async function routeHarnessRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: HarnessSessionManager,
): Promise<void> {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;

  if (pathname === "/health") {
    if (req.method !== "GET") {
      writeMethodNotAllowed(res);
      return;
    }

    handleHarnessHealthRequest(res);
    return;
  }

  if (pathname === "/api/chat") {
    if (req.method !== "POST") {
      writeMethodNotAllowed(res);
      return;
    }

    await handleHarnessChatRequest(req, res, sessionManager);
    return;
  }

  if (pathname === "/api/chat/abort") {
    if (req.method !== "POST") {
      writeMethodNotAllowed(res);
      return;
    }

    await handleHarnessAbortRequest(req, res, sessionManager);
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Not found." }));
}
