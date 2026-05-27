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
};

export type WorktreeSummary = WorktreeMapping & {
  status: "active" | "stopped" | "stale";
  exists: boolean;
  appOwned: boolean;
  dirtyState: "clean" | "dirty" | "unknown";
  sessionFileExists: boolean;
  activeAgentId?: string;
  removable: boolean;
  pruneable: boolean;
};

export function createWorktreeSummary(
  mapping: WorktreeMapping,
  disk: WorktreeDiskState,
  runtime: WorktreeRuntimeState = {},
): WorktreeSummary {
  const active = Boolean(runtime.activeAgentId);
  const hasSession = Boolean(mapping.sessionId && disk.sessionFileExists);
  const status = active ? "active" : disk.exists && hasSession ? "stopped" : "stale";
  const canCleanStale = status === "stale" && disk.appOwned && !active;
  const canRemoveExisting = canCleanStale && disk.exists && disk.dirtyState === "clean";
  const canPruneMissing = canCleanStale && !disk.exists;

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
  };
}
