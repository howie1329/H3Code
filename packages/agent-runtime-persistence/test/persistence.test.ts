import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { RuntimeBinding, SessionReadModel } from "@h3code/agent-protocol";

import { configurePersistenceStore } from "../src/config.js";
import { closePersistenceDatabase, getDatabase } from "../src/database.js";
import { createRuntimePersistence } from "../src/persistence.js";

async function withTempStore(run: (dataDir: string) => void | Promise<void>) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "h3-runtime-persistence-"));

  try {
    configurePersistenceStore({ dataDir });
    await run(dataDir);
  } finally {
    closePersistenceDatabase();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

function sampleSession(overrides: Partial<SessionReadModel> = {}): SessionReadModel {
  return {
    id: "h3-test-session",
    providerId: "pi",
    repoPath: "/repo",
    providerSessionRef: "/repo/.pi/sessions/a.jsonl",
    status: "idle",
    title: "Test session",
    messages: [
      {
        id: "m1",
        sessionId: "h3-test-session",
        turnId: "t1",
        role: "user",
        content: "hello",
        status: "completed",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    activities: [],
    pendingInteractions: [],
    updatedAt: 100,
    ...overrides,
  };
}

function sampleBinding(overrides: Partial<RuntimeBinding> = {}): RuntimeBinding {
  return {
    sessionId: "h3-test-session",
    providerId: "pi",
    repoPath: "/repo",
    providerSessionRef: "/repo/.pi/sessions/a.jsonl",
    status: "running",
    activeTurnId: "t1",
    lastEvent: "turn.started",
    lastEventAt: 50,
    ...overrides,
  };
}

test("save and load round-trip idle session", async () => {
  await withTempStore(async () => {
    const persistence = createRuntimePersistence(getDatabase());
    const session = sampleSession();

    await persistence.saveSession(session);
    const loaded = await persistence.loadSession("h3-test-session");

    assert.equal(loaded?.id, session.id);
    assert.equal(loaded?.status, session.status);
    assert.equal(loaded?.messages.length, 1);
    assert.equal(loaded?.messages[0]?.content, "hello");
    assert.deepEqual((await persistence.loadSessions()).map((item) => item.id), [session.id]);
  });
});

test("save and load running session preserves activeTurnId", async () => {
  await withTempStore(async () => {
    const persistence = createRuntimePersistence(getDatabase());
    const session = sampleSession({ status: "running", activeTurnId: "turn-42" });
    const binding = sampleBinding({ activeTurnId: "turn-42" });

    await persistence.saveSession(session);
    await persistence.saveBinding(binding);

    assert.equal((await persistence.loadSession("h3-test-session"))?.activeTurnId, "turn-42");
    const bindings = await persistence.loadBindings();
    assert.equal(bindings[0]?.sessionId, binding.sessionId);
    assert.equal(bindings[0]?.activeTurnId, "turn-42");
  });
});

test("deleteSession cascades child rows and binding", async () => {
  await withTempStore(async () => {
    const persistence = createRuntimePersistence(getDatabase());
    await persistence.saveSession(sampleSession());
    await persistence.saveBinding(sampleBinding());

    await persistence.deleteSession("h3-test-session");
    await persistence.deleteBinding("h3-test-session");

    assert.equal(await persistence.loadSession("h3-test-session"), undefined);
    assert.deepEqual(await persistence.loadBindings(), []);

    const db = getDatabase();
    assert.equal(
      (db.prepare("SELECT COUNT(*) AS count FROM runtime_messages").get() as { count: number }).count,
      0,
    );
  });
});
