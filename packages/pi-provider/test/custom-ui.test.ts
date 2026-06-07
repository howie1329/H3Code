import assert from "node:assert/strict";
import test from "node:test";

import { CustomUiCorrelation } from "../src/custom-ui-correlation.js";
import { PiExtensionUiBridge } from "../src/extension-ui.js";
import type { PiProviderEvent } from "../src/types.js";

test("custom() emits extension.ui.request and resolves from respond", async () => {
  const correlation = new CustomUiCorrelation();
  correlation.onExtensionEvent("rpiv:ask-user:prompt", { questions: [] });
  const events: PiProviderEvent[] = [];
  const bridge = new PiExtensionUiBridge((event) => events.push(event), correlation);
  const ctx = bridge.createContext();

  const pending = ctx.custom(async () => ({
    render: () => [],
    invalidate: () => {},
    handleInput: () => {},
  }));

  const request = events.find((event) => event.type === "extension.ui.request")?.request;
  assert.ok(request);
  assert.equal(request?.kind, "custom");
  assert.equal(request?.componentId, "rpiv:ask-user:prompt");

  bridge.respond({
    requestId: request!.id,
    kind: "custom",
    value: { answers: [], cancelled: false },
  });

  assert.deepEqual(await pending, { answers: [], cancelled: false });
});

test("custom() resolves undefined when canceled", async () => {
  const correlation = new CustomUiCorrelation();
  correlation.onExtensionEvent("rpiv:ask-user:prompt", { questions: [] });
  const events: PiProviderEvent[] = [];
  const bridge = new PiExtensionUiBridge((event) => events.push(event), correlation);
  const ctx = bridge.createContext();

  const pending = ctx.custom(async () => ({
    render: () => [],
    invalidate: () => {},
    handleInput: () => {},
  }));

  const request = events.find((event) => event.type === "extension.ui.request")?.request;
  assert.ok(request);

  bridge.respond({
    requestId: request!.id,
    kind: "custom",
    canceled: true,
  });

  assert.equal(await pending, undefined);
});
