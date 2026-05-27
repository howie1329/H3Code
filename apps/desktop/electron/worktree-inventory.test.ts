import assert from "node:assert/strict";
import test from "node:test";

import { createWorktreeSummary, type WorktreeMapping } from "./worktree-inventory.js";

const mapping: WorktreeMapping = {
  sessionPath: "/repo/.pi/sessions/session-a.json",
  repoPath: "/repo",
  repoName: "repo",
  worktreePath: "/app/pi-worktrees/repo-session-a",
  sessionId: "session-a",
  sessionName: "Session A",
};

test("classifies active worktrees as non-removable", () => {
  const summary = createWorktreeSummary(
    mapping,
    {
      exists: true,
      appOwned: true,
      dirtyState: "clean",
      sessionFileExists: true,
    },
    { activeAgentId: "agent-1" },
  );

  assert.equal(summary.status, "active");
  assert.equal(summary.removable, false);
  assert.equal(summary.pruneable, false);
});

test("classifies existing session worktrees as stopped and non-removable", () => {
  const summary = createWorktreeSummary(mapping, {
    exists: true,
    appOwned: true,
    dirtyState: "clean",
    sessionFileExists: true,
  });

  assert.equal(summary.status, "stopped");
  assert.equal(summary.removable, false);
  assert.equal(summary.pruneable, false);
});

test("classifies missing mapped worktrees as pruneable stale mappings", () => {
  const summary = createWorktreeSummary(mapping, {
    exists: false,
    appOwned: true,
    dirtyState: "clean",
    sessionFileExists: false,
  });

  assert.equal(summary.status, "stale");
  assert.equal(summary.removable, false);
  assert.equal(summary.pruneable, true);
});

test("allows clean orphaned app-owned worktrees to be removed", () => {
  const summary = createWorktreeSummary(
    { ...mapping, sessionId: undefined, sessionName: undefined },
    {
      exists: true,
      appOwned: true,
      dirtyState: "clean",
      sessionFileExists: false,
    },
  );

  assert.equal(summary.status, "stale");
  assert.equal(summary.removable, true);
  assert.equal(summary.pruneable, true);
});

test("keeps dirty stale worktrees", () => {
  const summary = createWorktreeSummary(
    { ...mapping, sessionId: undefined, sessionName: undefined },
    {
      exists: true,
      appOwned: true,
      dirtyState: "dirty",
      sessionFileExists: false,
    },
  );

  assert.equal(summary.status, "stale");
  assert.equal(summary.removable, false);
  assert.equal(summary.pruneable, false);
});

test("keeps non-app-owned stale worktrees", () => {
  const summary = createWorktreeSummary(
    { ...mapping, sessionId: undefined, sessionName: undefined },
    {
      exists: true,
      appOwned: false,
      dirtyState: "clean",
      sessionFileExists: false,
    },
  );

  assert.equal(summary.status, "stale");
  assert.equal(summary.removable, false);
  assert.equal(summary.pruneable, false);
});
