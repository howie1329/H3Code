import assert from "node:assert/strict";
import test from "node:test";

import { piRpcToDomainEvents } from "./adapter.js";
import { applySessionEvent, createInitialSessionReadModel } from "./projector.js";
import { transcriptMessages } from "./selectors.js";

test("transcriptMessages returns one user entry from committed messages only", () => {
  const model = createInitialSessionReadModel();
  model.messages = [{ id: "user-1", role: "user", content: "hello" }];

  const transcript = transcriptMessages(model);

  assert.equal(transcript.length, 1);
  assert.equal((transcript[0] as { role: string }).role, "user");
});

test("transcriptMessages stays single user after Pi message_end", () => {
  let model = createInitialSessionReadModel();

  model = applySessionEvent(
    model,
    piRpcToDomainEvents({
      type: "message_end",
      message: { id: "user-1", role: "user", content: "hello" },
    })[0]!,
  );

  const transcript = transcriptMessages(model);

  assert.equal(transcript.length, 1);
  assert.equal((transcript[0] as { role: string }).role, "user");
});
