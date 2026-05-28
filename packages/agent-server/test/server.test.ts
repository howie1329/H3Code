import assert from "node:assert/strict";
import { test } from "node:test";
import type { ServerToClientMessage } from "@h3code/agent-core";
import WebSocket from "ws";
import { startAgentServer } from "../src/index.js";

test("starts a localhost websocket server and sends server.ready", async () => {
  const server = await startAgentServer();

  try {
    assert.equal(server.host, "127.0.0.1");
    assert.ok(server.port > 0);

    const client = await openReadySocket(server.url);
    const { socket, ready } = client;

    assert.equal(ready.type, "server.ready");
    assert.equal(ready.protocolVersion, 1);
    assert.ok(ready.providers.some((provider) => provider.id === "noop"));

    socket.close();
  } finally {
    await server.close();
  }
});

test("returns an error for malformed json", async () => {
  const server = await startAgentServer();

  try {
    const client = await openReadySocket(server.url);
    const { socket } = client;

    socket.send("{");
    const message = await client.nextMessage();

    assert.equal(message.type, "error");
    assert.equal(message.code, "invalid_json");

    socket.close();
  } finally {
    await server.close();
  }
});

test("connects to noop provider and emits session events on message.send", async () => {
  const server = await startAgentServer();

  try {
    const client = await openReadySocket(server.url);
    const { socket } = client;

    socket.send(JSON.stringify({ type: "workspace.connect", id: "1", providerId: "noop", repoPath: "/tmp" }));
    const status = await client.nextMessage();

    assert.equal(status.type, "connection.status");
    assert.equal(status.state, "connected");

    const connectionId = status.connectionId;
    socket.send(
      JSON.stringify({
        type: "message.send",
        id: "2",
        connectionId,
        text: "hello",
        mode: "prompt",
      }),
    );

    const started = await client.nextMessage();
    const added = await client.nextMessage();
    const completed = await client.nextMessage();

    assert.equal(started.type, "session.event");
    assert.equal(started.event.type, "run.started");
    assert.equal(added.type, "session.event");
    assert.equal(added.event.type, "message.streaming");
    assert.equal(completed.type, "session.event");
    assert.equal(completed.event.type, "run.ended");

    socket.close();
  } finally {
    await server.close();
  }
});

test("routes implemented session and provider commands through connections", async () => {
  const server = await startAgentServer();

  try {
    const client = await openReadySocket(server.url);
    const { socket } = client;

    socket.send(JSON.stringify({ type: "workspace.connect", id: "1", providerId: "noop", repoPath: "/tmp" }));
    const status = await client.nextMessage();

    assert.equal(status.type, "connection.status");
    const connectionId = status.connectionId;

    socket.send(JSON.stringify({ type: "session.create", id: "2", connectionId }));
    const createError = await client.nextMessage();
    assert.equal(createError.type, "error");
    assert.equal(createError.code, "unsupported_command");

    socket.send(
      JSON.stringify({
        type: "provider.ui.respond",
        id: "3",
        connectionId,
        response: { requestId: "ui-1", kind: "input", value: "ok" },
      }),
    );
    const uiError = await client.nextMessage();
    assert.equal(uiError.type, "error");
    assert.equal(uiError.code, "unsupported_command");

    socket.close();
  } finally {
    await server.close();
  }
});

test("returns an error for unknown connection", async () => {
  const server = await startAgentServer();

  try {
    const client = await openReadySocket(server.url);
    const { socket } = client;

    socket.send(JSON.stringify({ type: "session.snapshot", id: "1", connectionId: "missing" }));
    const message = await client.nextMessage();

    assert.equal(message.type, "error");
    assert.equal(message.id, "1");
    assert.equal(message.code, "connection_not_found");

    socket.close();
  } finally {
    await server.close();
  }
});

type TestSocket = {
  socket: WebSocket;
  ready: ServerToClientMessage;
  nextMessage: () => Promise<ServerToClientMessage>;
};

function openReadySocket(url: string) {
  return new Promise<TestSocket>((resolve, reject) => {
    const socket = new WebSocket(url);
    const messages: ServerToClientMessage[] = [];
    const waiting: Array<(message: ServerToClientMessage) => void> = [];
    let ready: ServerToClientMessage | undefined;

    const nextMessage = () =>
      new Promise<ServerToClientMessage>((resolveMessage) => {
        const message = messages.shift();

        if (message) {
          resolveMessage(message);
          return;
        }

        waiting.push(resolveMessage);
      });

    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as ServerToClientMessage;

        if (!ready) {
          ready = message;
          resolve({ socket, ready, nextMessage });
          return;
        }

        const resolveMessage = waiting.shift();

        if (resolveMessage) {
          resolveMessage(message);
          return;
        }

        messages.push(message);
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });
}
