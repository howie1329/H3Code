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

test("classifies running worktrees as non-removable and non-archivable", () => {
  const summary = createWorktreeSummary(
    mapping,
    {
      exists: true,
      appOwned: true,
      dirtyState: "clean",
      sessionFileExists: true,
    },
    { activeAgentId: "agent-1", isRunning: true },
  );

  assert.equal(summary.status, "running");
  assert.equal(summary.removable, false);
  assert.equal(summary.pruneable, false);
  assert.equal(summary.archivable, false);
});

test("classifies connected idle session worktrees as archivable", () => {
  const summary = createWorktreeSummary(
    mapping,
    {
      exists: true,
      appOwned: true,
      dirtyState: "clean",
      sessionFileExists: true,
    },
    { activeAgentId: "agent-1", isRunning: false },
  );

  assert.equal(summary.status, "idle");
  assert.equal(summary.removable, false);
  assert.equal(summary.pruneable, false);
  assert.equal(summary.archivable, true);
});

test("classifies existing session worktrees as stopped and archivable", () => {
  const summary = createWorktreeSummary(mapping, {
    exists: true,
    appOwned: true,
    dirtyState: "clean",
    sessionFileExists: true,
  });

  assert.equal(summary.status, "stopped");
  assert.equal(summary.removable, false);
  assert.equal(summary.pruneable, false);
  assert.equal(summary.archivable, true);
});

test("keeps running worktrees non-archivable", () => {
  const summary = createWorktreeSummary(
    mapping,
    {
      exists: true,
      appOwned: true,
      dirtyState: "clean",
      sessionFileExists: true,
    },
    { activeAgentId: "agent-1", isRunning: true },
  );

  assert.equal(summary.archivable, false);
});

test("keeps dirty idle worktrees non-archivable", () => {
  const summary = createWorktreeSummary(
    mapping,
    {
      exists: true,
      appOwned: true,
      dirtyState: "dirty",
      sessionFileExists: true,
    },
    { activeAgentId: "agent-1", isRunning: false },
  );

  assert.equal(summary.status, "idle");
  assert.equal(summary.archivable, false);
});

test("keeps dirty stopped worktrees non-archivable", () => {
  const summary = createWorktreeSummary(mapping, {
    exists: true,
    appOwned: true,
    dirtyState: "dirty",
    sessionFileExists: true,
  });

  assert.equal(summary.status, "stopped");
  assert.equal(summary.archivable, false);
});

test("keeps unknown-state stopped worktrees non-archivable", () => {
  const summary = createWorktreeSummary(mapping, {
    exists: true,
    appOwned: true,
    dirtyState: "unknown",
    sessionFileExists: true,
  });

  assert.equal(summary.status, "stopped");
  assert.equal(summary.archivable, false);
});

test("keeps stopped worktrees with in-worktree session files non-archivable", () => {
  const summary = createWorktreeSummary(
    {
      ...mapping,
      sessionPath: "/app/pi-worktrees/repo-session-a/.pi/sessions/session-a.json",
    },
    {
      exists: true,
      appOwned: true,
      dirtyState: "clean",
      sessionFileExists: true,
    },
  );

  assert.equal(summary.status, "stopped");
  assert.equal(summary.archivable, false);
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
  assert.equal(summary.archivable, false);
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
