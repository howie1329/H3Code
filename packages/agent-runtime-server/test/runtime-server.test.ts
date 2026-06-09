import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AGENT_PROTOCOL_VERSION, type AgentCommand, type ProviderAdapter, type RuntimeBinding, type ServerToClientMessage, type SessionReadModel } from "@h3code/agent-protocol";
import { AgentRuntime } from "@h3code/agent-runtime";
import { closePersistenceDatabase, type RuntimePersistence } from "@h3code/agent-runtime-persistence";
import {
  closePreferencesDatabase,
  configureMetadataStore,
  getRegisteredSession,
  isRegisteredSession,
  registerH3CodeSession,
} from "@h3code/agent-metadata";
import { PiProviderAdapter } from "@h3code/agent-provider-pi";
import { startH3CodeRuntimeServer } from "../src/index.js";
import WebSocket from "ws";

test("starts runtime server and registers PI provider", async () => {
  await withTempDataDir(async (dataDir) => {
    const server = await startH3CodeRuntimeServer({ host: "127.0.0.1", dataDir });
    try {
      assert.ok(server.port);
      const descriptors = server.runtime.descriptors();
      assert.equal(descriptors.some((descriptor) => descriptor.id === "pi"), true);
    } finally {
      await server.close();
    }
  });
});

test("does not auto-register PI when runtime is injected", async () => {
  await withTempDataDir(async (dataDir) => {
    const runtime = new AgentRuntime({ providers: [new PiProviderAdapter()] });
    const server = await startH3CodeRuntimeServer({ host: "127.0.0.1", dataDir, runtime });
    try {
      assert.equal(server.runtime, runtime);
      assert.equal(server.runtime.descriptors().filter((descriptor) => descriptor.id === "pi").length, 1);
    } finally {
      await server.close();
    }
  });
});

test("registers created sessions in metadata through the runtime server", async () => {
  await withTempDataDir(async (dataDir) => {
    const provider = fakeProvider({
      async startSession(request, sink) {
        await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: "created.jsonl", occurredAt: 1 });
        await sink({
          type: "session.updated",
          sessionId: request.sessionId,
          providerId: request.providerId,
          title: "Created session",
          messages: [{ id: "u1", role: "user", content: "first prompt" }],
          occurredAt: 2,
        });
        return { binding: { sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: "created.jsonl", status: "running" }, async stop() {} };
      },
    });
    const runtime = new AgentRuntime({ providers: [provider], idFactory: () => "h3-created" });
    const server = await startH3CodeRuntimeServer({ host: "127.0.0.1", dataDir, runtime });

    try {
      assert.ok(server.port);
      const response = await sendCommand(server.port, { type: "session.create", repoPath: "/repo", providerId: "fake" });
      assert.equal(response.type, "command.result");
      assert.equal(response.payload.session?.id, "h3-created");

      const registered = getRegisteredSession("h3-created");
      assert.equal(registered?.h3codeSessionId, "h3-created");
      assert.equal(registered?.repoPath, "/repo");
      assert.equal(registered?.providerId, "fake");
      assert.equal(registered?.providerSessionRef, "created.jsonl");
      assert.equal(registered?.name, "Created session");
      assert.equal(registered?.messageCount, 1);
      assert.equal(registered?.firstMessage, "first prompt");
    } finally {
      await server.close();
    }
  });
});

test("repairs and reconciles persisted sessions after server startup", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "h3-runtime-server-"));
  const resumed: string[] = [];
  const persistence = fakePersistence(
    [persistedSession("h3-s1"), persistedSession("h3-unregistered")],
    [persistedBinding("h3-s1"), persistedBinding("h3-unregistered")],
  );
  const provider = fakeProvider({
    async resumeSession(request, sink) {
      resumed.push(request.sessionId);
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: request.providerSessionRef, occurredAt: 1 });
      return { binding: { ...request, status: "running" }, async stop() {} };
    },
  });

  try {
    configureMetadataStore({ dataDir });
    registerH3CodeSession({
      h3codeSessionId: "h3-s1",
      repoPath: "/repo",
      providerId: "fake",
      providerSessionRef: "h3-s1.jsonl",
    });

    const runtime = new AgentRuntime({ providers: [provider], persistence });
    const server = await startH3CodeRuntimeServer({ host: "127.0.0.1", dataDir, runtime });
    try {
      await server.reconciliation;
      assert.deepEqual(resumed, ["h3-s1", "h3-unregistered"]);
      assert.equal(server.runtime.getSnapshot("h3-s1")?.providerSessionRef, "h3-s1.jsonl");
      assert.equal(server.runtime.getSnapshot("h3-unregistered")?.providerSessionRef, "h3-unregistered.jsonl");
      assert.equal(getRegisteredSession("h3-unregistered")?.providerSessionRef, "h3-unregistered.jsonl");
    } finally {
      await server.close();
    }
  } finally {
    closePreferencesDatabase();
    closePersistenceDatabase();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("leaves persisted bindings without read models unregistered during startup repair", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "h3-runtime-server-"));
  const resumed: string[] = [];
  const persistence = fakePersistence(
    [persistedSession("h3-repairable")],
    [persistedBinding("h3-repairable"), persistedBinding("h3-no-read-model")],
  );
  const provider = fakeProvider({
    async resumeSession(request, sink) {
      resumed.push(request.sessionId);
      await sink({ type: "session.started", sessionId: request.sessionId, providerId: request.providerId, repoPath: request.repoPath, providerSessionRef: request.providerSessionRef, occurredAt: 1 });
      return { binding: { ...request, status: "running" }, async stop() {} };
    },
  });

  try {
    const runtime = new AgentRuntime({ providers: [provider], persistence });
    const server = await startH3CodeRuntimeServer({ host: "127.0.0.1", dataDir, runtime });
    try {
      await server.reconciliation;
      assert.deepEqual(resumed, ["h3-repairable"]);
      assert.equal(isRegisteredSession("h3-repairable"), true);
      assert.equal(isRegisteredSession("h3-no-read-model"), false);
    } finally {
      await server.close();
    }
  } finally {
    closePreferencesDatabase();
    closePersistenceDatabase();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

function persistedSession(id: string): SessionReadModel {
  return {
    id,
    providerId: "fake",
    repoPath: "/repo",
    providerSessionRef: `${id}.jsonl`,
    status: "idle",
    messages: [],
    activities: [],
    pendingInteractions: [],
    updatedAt: 1,
  };
}

function fakeProvider(overrides: Partial<ProviderAdapter>): ProviderAdapter {
  return {
    descriptor: { id: "fake", name: "Fake", capabilities: { streaming: true, sessionResume: true, approvals: false, userInputRequests: false, cancellation: false, attachments: false } },
    async startSession() { throw new Error("not used"); },
    async resumeSession() { throw new Error("not used"); },
    async sendTurn() {},
    async abortTurn() {},
    ...overrides,
  };
}

async function sendCommand(port: number, payload: AgentCommand): Promise<ServerToClientMessage> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);

  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  const response = new Promise<ServerToClientMessage>((resolve, reject) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString()) as ServerToClientMessage));
    socket.once("error", reject);
  });

  socket.send(JSON.stringify({
    id: "req1",
    type: "command",
    protocolVersion: AGENT_PROTOCOL_VERSION,
    payload,
  }));

  try {
    return await response;
  } finally {
    socket.close();
  }
}

async function withTempDataDir(run: (dataDir: string) => void | Promise<void>) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "h3-runtime-server-"));

  try {
    await run(dataDir);
  } finally {
    closePreferencesDatabase();
    closePersistenceDatabase();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

function persistedBinding(sessionId: string): RuntimeBinding {
  return {
    sessionId,
    providerId: "fake",
    repoPath: "/repo",
    providerSessionRef: `${sessionId}.jsonl`,
    status: "stopped",
  };
}

function fakePersistence(sessions: SessionReadModel[], bindings: RuntimeBinding[]): RuntimePersistence {
  return {
    async loadSessions() { return sessions; },
    async loadSession(sessionId) { return sessions.find((session) => session.id === sessionId); },
    async saveSession(session) {
      const index = sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) sessions[index] = session;
    },
    async deleteSession(sessionId) {
      const index = sessions.findIndex((session) => session.id === sessionId);
      if (index >= 0) sessions.splice(index, 1);
    },
    async loadBindings() { return bindings; },
    async saveBinding(binding) {
      const index = bindings.findIndex((item) => item.sessionId === binding.sessionId);
      if (index >= 0) bindings[index] = binding;
    },
    async deleteBinding(sessionId) {
      const index = bindings.findIndex((binding) => binding.sessionId === sessionId);
      if (index >= 0) bindings.splice(index, 1);
    },
  };
}
