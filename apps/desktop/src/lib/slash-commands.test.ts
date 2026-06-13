import assert from "node:assert/strict";
import test from "node:test";

import {
  findCompletedSkillToken,
  getActiveSlashToken,
  removeSlashToken,
  replaceSlashToken,
} from "./slash-commands.js";

const skill = { name: "skill:frontend", source: "skill" as const };

test("getActiveSlashToken returns the slash token at the cursor", () => {
  assert.deepEqual(getActiveSlashToken("Use /skill:front", 16), {
    start: 4,
    end: 16,
    query: "skill:front",
  });
});

test("replaceSlashToken inserts the selected command text", () => {
  const result = replaceSlashToken("Use /sk", { start: 4, end: 7, query: "sk" }, skill);

  assert.deepEqual(result, {
    value: "Use /skill:frontend ",
    cursor: 20,
  });
});

test("removeSlashToken removes a selected skill from prompt text", () => {
  const result = removeSlashToken("Use /skill:frontend this", { start: 4, end: 19, query: "skill:frontend" });

  assert.deepEqual(result, {
    value: "Use this",
    cursor: 4,
  });
});

test("findCompletedSkillToken matches typed Pi skill commands", () => {
  const result = findCompletedSkillToken("/skill:frontend build the page", [skill]);

  assert.equal(result?.command, skill);
  assert.deepEqual(result?.token, {
    start: 0,
    end: 15,
    query: "skill:frontend",
  });
});
