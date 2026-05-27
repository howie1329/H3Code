import path from "node:path";

export type WorktreeMapping = {
  sessionPath: string;
  repoPath: string;
  repoName: string;
  worktreePath: string;
  sessionId?: string;
  sessionName?: string;
};

export type WorktreeDiskState = {
  exists: boolean;
  appOwned: boolean;
  dirtyState: "clean" | "dirty" | "unknown";
  sessionFileExists: boolean;
};

export type WorktreeRuntimeState = {
  activeAgentId?: string;
  isRunning?: boolean;
};

export type WorktreeSummary = WorktreeMapping & {
  status: "running" | "idle" | "stopped" | "stale";
  exists: boolean;
  appOwned: boolean;
  dirtyState: "clean" | "dirty" | "unknown";
  sessionFileExists: boolean;
  activeAgentId?: string;
  removable: boolean;
  pruneable: boolean;
  archivable: boolean;
  sessionFileInWorktree: boolean;
};

export function createWorktreeSummary(
  mapping: WorktreeMapping,
  disk: WorktreeDiskState,
  runtime: WorktreeRuntimeState = {},
): WorktreeSummary {
  const active = Boolean(runtime.activeAgentId);
  const running = active && runtime.isRunning === true;
  const hasSession = Boolean(mapping.sessionId && disk.sessionFileExists);
  const status = running ? "running" : active ? "idle" : disk.exists && hasSession ? "stopped" : "stale";
  const canCleanStale = status === "stale" && disk.appOwned && !active;
  const canRemoveExisting = canCleanStale && disk.exists && disk.dirtyState === "clean";
  const canPruneMissing = canCleanStale && !disk.exists;
  const sessionFileInWorktree = isPathInside(mapping.worktreePath, mapping.sessionPath);
  const archivable = (status === "idle" || status === "stopped") &&
    disk.appOwned &&
    disk.exists &&
    disk.dirtyState === "clean" &&
    hasSession &&
    !sessionFileInWorktree;

  return {
    ...mapping,
    status,
    exists: disk.exists,
    appOwned: disk.appOwned,
    dirtyState: disk.dirtyState,
    sessionFileExists: disk.sessionFileExists,
    activeAgentId: runtime.activeAgentId,
    removable: canRemoveExisting,
    pruneable: canRemoveExisting || canPruneMissing,
    archivable,
    sessionFileInWorktree,
  };
}

function isPathInside(parentPath: string, childPath: string) {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
