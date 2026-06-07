import assert from "node:assert/strict";
import test from "node:test";

import { CustomUiCorrelation } from "../src/custom-ui-correlation.js";

test("consumes rpiv ask-user prompt for next custom call", () => {
  const correlation = new CustomUiCorrelation();
  correlation.onExtensionEvent("rpiv:ask-user:prompt", {
    questions: [{ question: "Pick?", header: "Scope", multiSelect: false, options: [] }],
  });

  const match = correlation.consumeForCustom();

  assert.equal(match?.componentId, "rpiv:ask-user:prompt");
  assert.ok(Array.isArray((match?.payload as { questions: unknown[] }).questions));
});

test("falls back to ask_user_question tool args", () => {
  const correlation = new CustomUiCorrelation();
  correlation.onToolExecutionStart("ask_user_question", {
    questions: [
      {
        question: "Go?",
        header: "Plan",
        options: [
          { label: "Yes", description: "d" },
          { label: "No", description: "d" },
        ],
      },
    ],
  });

  const match = correlation.consumeForCustom();

  assert.equal(match?.componentId, "rpiv:ask-user:prompt");
});

test("prefers extension event over tool args", () => {
  const correlation = new CustomUiCorrelation();
  correlation.onToolExecutionStart("ask_user_question", { questions: [{ question: "tool" }] });
  correlation.onExtensionEvent("rpiv:ask-user:prompt", { questions: [{ question: "event" }] });

  const match = correlation.consumeForCustom();

  assert.deepEqual((match?.payload as { questions: Array<{ question: string }> }).questions[0]?.question, "event");
});

test("clear removes pending matches", () => {
  const correlation = new CustomUiCorrelation();
  correlation.onExtensionEvent("rpiv:ask-user:prompt", { questions: [] });
  correlation.clear();

  assert.equal(correlation.consumeForCustom(), undefined);
});
