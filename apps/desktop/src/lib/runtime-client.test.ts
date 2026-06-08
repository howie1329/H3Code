import { AGENT_PROTOCOL_VERSION, type ClientToServerMessage, type ServerToClientMessage, type SessionReadModel } from "@h3code/agent-protocol";
import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeClient } from "./runtime-client.js";

function inferSessionId(event: { type: string; sessionId?: string; session?: { id: string } }) {
  if (event.type === "session.snapshot") {
    return event.session!.id;
  }

  return event.sessionId!;
}

test("command.result request ids map to pending requests", () => {
  const pending = new Map<string, { session?: { id: string } }>();
  pending.set("req-1", {});

  const response = {
    type: "command.result" as const,
    protocolVersion: AGENT_PROTOCOL_VERSION,
    payload: { requestId: "req-1", session: { id: "s1" } },
  };

  assert.equal(response.payload.requestId, "req-1");
  assert.ok(pending.has(response.payload.requestId!));
  assert.equal(response.payload.session?.id, "s1");
});

test("session.event payloads include a session id", () => {
  const event = {
    type: "session.patch",
    sessionId: "s1",
    patch: { status: "running" as const, updatedAt: 2 },
  };

  assert.equal(inferSessionId(event), "s1");
});

test("snapshot requests resolve by request id when responses arrive out of order", async () => {
  const sockets = installFakeWebSocket();
  const client = new RuntimeClient(async () => "ws://runtime");
  await client.ensureConnected();

  const first = client.requestSnapshot("s1");
  const second = client.requestSnapshot("s2");

  const socket = sockets[0]!;
  await waitForSent(socket, 2);
  const firstRequest = JSON.parse(socket.sent[0]!) as ClientToServerMessage;
  const secondRequest = JSON.parse(socket.sent[1]!) as ClientToServerMessage;

  socket.receive(snapshotResponse(secondRequest.id!, createSession("s2")));
  socket.receive(snapshotResponse(firstRequest.id!, createSession("s1")));

  assert.equal((await first).id, "s1");
  assert.equal((await second).id, "s2");

  client.close();
  restoreWebSocket();
});

test("closing runtime client rejects pending snapshot requests", async () => {
  const sockets = installFakeWebSocket();
  const client = new RuntimeClient(async () => "ws://runtime");
  await client.ensureConnected();

  const snapshot = client.requestSnapshot("s1");
  await waitForSent(sockets[0]!, 1);

  client.close();

  await assert.rejects(snapshot, /Runtime client closed/);
  restoreWebSocket();
});

let originalWebSocket: typeof WebSocket | undefined;

function installFakeWebSocket() {
  const sockets: FakeWebSocket[] = [];
  originalWebSocket = globalThis.WebSocket;

  globalThis.WebSocket = class extends FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    constructor(url: string) {
      super(url);
      sockets.push(this);
    }
  } as unknown as typeof WebSocket;
  return sockets;
}

function restoreWebSocket() {
  if (originalWebSocket) {
    globalThis.WebSocket = originalWebSocket;
  }
}

async function waitForSent(socket: FakeWebSocket, count: number) {
  for (let index = 0; index < 20; index += 1) {
    if (socket.sent.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(`Expected ${count} sent messages, got ${socket.sent.length}.`);
}


class FakeWebSocket {
  static readonly OPEN = 1;
  readonly OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  readonly listeners = new Map<string, Array<(event: { data?: string }) => void>>();

  constructor(readonly url: string) {
    queueMicrotask(() => this.emit("open", {}));
  }

  addEventListener(type: string, listener: (event: { data?: string }) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(message: string) {
    this.sent.push(message);
  }

  close() {
    this.readyState = 3;
    this.emit("close", {});
  }

  receive(message: ServerToClientMessage) {
    this.emit("message", { data: JSON.stringify(message) });
  }

  private emit(type: string, event: { data?: string }) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function snapshotResponse(requestId: string, session: SessionReadModel): ServerToClientMessage {
  return {
    type: "session.snapshot.response",
    protocolVersion: AGENT_PROTOCOL_VERSION,
    payload: { requestId, session },
  };
}

function createSession(id: string): SessionReadModel {
  return {
    id,
    providerId: "pi",
    repoPath: "/repo",
    status: "idle",
    messages: [],
    activities: [],
    pendingInteractions: [],
    updatedAt: 1,
  };
}
