import type { IncomingMessage, ServerResponse } from "node:http";

import { pipeUIMessageStreamToResponse, toUIMessageStream, type UIMessage } from "ai";

import type { HarnessSessionManager } from "./harness-session-manager.js";

export type ChatRequestBody = {
  id?: string;
  sessionId?: string;
  repoPath?: string;
  messages?: UIMessage[];
};

export type AbortRequestBody = {
  sessionId?: string;
  id?: string;
};

function writeJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function resolveSessionId(body: { id?: string; sessionId?: string }): string | undefined {
  return body.sessionId?.trim() || body.id?.trim() || undefined;
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
}

export async function handleHarnessChatRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: HarnessSessionManager,
): Promise<void> {
  let body: ChatRequestBody;

  try {
    body = await readJsonBody<ChatRequestBody>(req);
  } catch {
    writeJson(res, 400, { error: "Invalid JSON body." });
    return;
  }

  const sessionId = resolveSessionId(body);
  const repoPath = body.repoPath?.trim();
  const messages = body.messages;

  if (!sessionId) {
    writeJson(res, 400, { error: "Missing session id." });
    return;
  }

  if (!repoPath) {
    writeJson(res, 400, { error: "Missing repoPath." });
    return;
  }

  if (!messages || messages.length === 0) {
    writeJson(res, 400, { error: "Missing messages." });
    return;
  }

  try {
    const abortController = new AbortController();
    req.on("aborted", () => {
      abortController.abort();
    });
    req.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const { result, finalize } = await sessionManager.streamChat({
      sessionId,
      repoPath,
      messages,
      abortSignal: abortController.signal,
    });

    let finalized = false;
    const release = () => {
      if (finalized) {
        return;
      }

      finalized = true;
      finalize();
    };

    res.on("close", release);
    res.on("finish", release);

    const uiStream = toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
    });

    pipeUIMessageStreamToResponse({
      response: res,
      stream: uiStream,
    });
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    writeJson(res, 500, { error: message });
  }
}

export async function handleHarnessAbortRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: HarnessSessionManager,
): Promise<void> {
  let body: AbortRequestBody;

  try {
    body = await readJsonBody<AbortRequestBody>(req);
  } catch {
    writeJson(res, 400, { error: "Invalid JSON body." });
    return;
  }

  const sessionId = resolveSessionId(body);
  if (!sessionId) {
    writeJson(res, 400, { error: "Missing session id." });
    return;
  }

  const aborted = sessionManager.abortSession(sessionId);
  writeJson(res, 200, { ok: true, aborted });
}

export function handleHarnessHealthRequest(res: ServerResponse): void {
  writeJson(res, 200, { ok: true });
}
