import assert from "node:assert/strict";
import { test } from "node:test";
import WebSocket from "ws";
import { NoopProvider } from "../src/noop-provider.js";
import { startAgentServer } from "../src/index.js";
import { FakeUiProvider } from "./fake-ui-provider.js";
function startTestServer() {
    return startAgentServer({ providers: [new NoopProvider()] });
}
test("startAgentServer rejects empty providers", async () => {
    await assert.rejects(() => startAgentServer({ providers: [] }), /requires at least one provider/);
});
test("starts a localhost websocket server and sends server.ready", async () => {
    const server = await startTestServer();
    try {
        assert.equal(server.host, "127.0.0.1");
        assert.ok(server.port > 0);
        const client = await openReadySocket(server.url);
        const { socket, ready } = client;
        assert.equal(ready.type, "server.ready");
        assert.equal(ready.protocolVersion, 1);
        assert.ok(ready.providers.some((provider) => provider.id === "noop"));
        socket.close();
    }
    finally {
        await server.close();
    }
});
test("returns an error for malformed json", async () => {
    const server = await startTestServer();
    try {
        const client = await openReadySocket(server.url);
        const { socket } = client;
        socket.send("{");
        const message = await client.nextMessage();
        assert.equal(message.type, "error");
        assert.equal(message.code, "invalid_json");
        socket.close();
    }
    finally {
        await server.close();
    }
});
test("connects to noop provider and emits session events on message.send", async () => {
    const server = await startTestServer();
    try {
        const client = await openReadySocket(server.url);
        const { socket } = client;
        socket.send(JSON.stringify({ type: "workspace.connect", id: "1", providerId: "noop", repoPath: "/tmp" }));
        const status = await client.nextMessage();
        assert.equal(status.type, "connection.status");
        assert.equal(status.state, "connected");
        const connectionId = status.connectionId;
        socket.send(JSON.stringify({
            type: "message.send",
            id: "2",
            connectionId,
            text: "hello",
            mode: "prompt",
        }));
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
    }
    finally {
        await server.close();
    }
});
test("routes implemented session and provider commands through connections", async () => {
    const server = await startTestServer();
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
        socket.send(JSON.stringify({
            type: "provider.ui.respond",
            id: "3",
            connectionId,
            response: { requestId: "ui-1", kind: "input", value: "ok" },
        }));
        const uiError = await client.nextMessage();
        assert.equal(uiError.type, "error");
        assert.equal(uiError.code, "unsupported_command");
        socket.close();
    }
    finally {
        await server.close();
    }
});
test("returns an error for unknown connection", async () => {
    const server = await startTestServer();
    try {
        const client = await openReadySocket(server.url);
        const { socket } = client;
        socket.send(JSON.stringify({ type: "session.snapshot", id: "1", connectionId: "missing" }));
        const message = await client.nextMessage();
        assert.equal(message.type, "error");
        assert.equal(message.id, "1");
        assert.equal(message.code, "connection_not_found");
        socket.close();
    }
    finally {
        await server.close();
    }
});
test("uplifts extension.ui.request to provider.ui.request", async () => {
    const server = await startAgentServer({ providers: [new FakeUiProvider()] });
    try {
        const client = await openReadySocket(server.url);
        const { socket } = client;
        socket.send(JSON.stringify({ type: "workspace.connect", id: "1", providerId: "fake-ui", repoPath: "/tmp" }));
        const status = await client.nextMessage();
        assert.equal(status.type, "connection.status");
        const connectionId = status.connectionId;
        socket.send(JSON.stringify({
            type: "message.send",
            id: "2",
            connectionId,
            text: "trigger ui",
            mode: "prompt",
        }));
        const uiRequest = await client.nextMessage();
        assert.equal(uiRequest.type, "provider.ui.request");
        assert.equal(uiRequest.connectionId, connectionId);
        assert.equal(uiRequest.request.id, "ui-test-1");
        assert.equal(uiRequest.request.kind, "input");
        socket.close();
    }
    finally {
        await server.close();
    }
});
function openReadySocket(url) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url);
        const messages = [];
        const waiting = [];
        let ready;
        const nextMessage = () => new Promise((resolveMessage) => {
            const message = messages.shift();
            if (message) {
                resolveMessage(message);
                return;
            }
            waiting.push(resolveMessage);
        });
        socket.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
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
            }
            catch (error) {
                reject(error);
            }
        });
        socket.once("error", reject);
    });
}
//# sourceMappingURL=server.test.js.map