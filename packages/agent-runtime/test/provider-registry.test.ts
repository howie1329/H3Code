import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderAdapter } from "@h3code/agent-protocol";
import { ProviderRegistry } from "../src/provider-registry.js";

const provider: ProviderAdapter = {
  descriptor: { id: "fake", name: "Fake", capabilities: { streaming: true, sessionResume: true, approvals: true, userInputRequests: true, cancellation: true, attachments: false } },
  async startSession() { throw new Error("unused"); },
  async resumeSession() { throw new Error("unused"); },
  async sendTurn() {},
  async abortTurn() {},
};

test("registers and lists provider descriptors", () => {
  const registry = new ProviderRegistry([provider]);
  assert.deepEqual(registry.descriptors(), [provider.descriptor]);
  assert.equal(registry.get("fake"), provider);
});

test("rejects duplicate providers", () => {
  assert.throws(() => new ProviderRegistry([provider, provider]), /Provider already registered/);
});
