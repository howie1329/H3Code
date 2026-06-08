import assert from "node:assert/strict";
import test from "node:test";
import { AgentRuntime } from "@h3code/agent-runtime";
import { PiProviderAdapter } from "@h3code/agent-provider-pi";
import { startH3CodeRuntimeServer } from "../src/index.js";

test("starts runtime server and registers PI provider", async () => {
  const server = await startH3CodeRuntimeServer();
  try {
    assert.ok(server.port);
    const descriptors = server.runtime.descriptors();
    assert.equal(descriptors.some((descriptor) => descriptor.id === "pi"), true);
  } finally {
    await server.close();
  }
});

test("does not auto-register PI when runtime is injected", async () => {
  const runtime = new AgentRuntime({ providers: [new PiProviderAdapter()] });
  const server = await startH3CodeRuntimeServer({ runtime });
  try {
    assert.equal(server.runtime, runtime);
    assert.equal(server.runtime.descriptors().filter((descriptor) => descriptor.id === "pi").length, 1);
  } finally {
    await server.close();
  }
});
