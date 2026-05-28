export type DesktopShellApi = {
  getAppVersion: () => Promise<string>;
  pickExecutable: () => Promise<{ path: string } | null>;
  selectRepo: () => Promise<{ path: string } | null>;
  deletePiSession: (repoPath: string, sessionPath: string) => Promise<PiSessionSummary[]>;
  getSessionStats: (worktreePath?: string) => Promise<PiSessionStats | null>;
  getSessionDiff: (worktreePath?: string) => Promise<PiSessionDiff>;
  revealWorktree: (worktreePath?: string) => Promise<string>;
  listWorktrees: () => Promise<PiWorktreeSummary[]>;
  revealWorktreePath: (worktreePath: string) => Promise<string>;
  removeStaleWorktree: (sessionPath: string) => Promise<PiWorktreeCleanupResult>;
  archiveSessionWorktree: (sessionPath: string) => Promise<PiWorktreeArchiveResult>;
  pruneStaleWorktrees: () => Promise<PiWorktreeCleanupResult>;
  revealPreferencesDatabase: () => Promise<string>;
};

function requireH3Code() {
  if (!window.h3code) {
    throw new Error("Desktop API is unavailable.");
  }

  return window.h3code;
}

export function getDesktopShellApi(): DesktopShellApi {
  const api = requireH3Code();
  const shell = api.shell;

  return {
    getAppVersion: () => api.getAppVersion(),
    pickExecutable: () => api.pickExecutable(),
    selectRepo: () => api.selectRepo(),
    deletePiSession: (repoPath, sessionPath) =>
      shell?.deletePiSession
        ? shell.deletePiSession(repoPath, sessionPath)
        : api.deletePiSession(repoPath, sessionPath),
    getSessionStats: (worktreePath) =>
      shell?.getSessionStats ? shell.getSessionStats(worktreePath) : api.getSessionStats(worktreePath),
    getSessionDiff: (worktreePath) =>
      shell?.getSessionDiff ? shell.getSessionDiff(worktreePath) : api.getSessionDiff(worktreePath),
    revealWorktree: (worktreePath) =>
      shell?.revealWorktree ? shell.revealWorktree(worktreePath) : api.revealWorktree(worktreePath),
    listWorktrees: () => (shell?.listWorktrees ? shell.listWorktrees() : api.listWorktrees()),
    revealWorktreePath: (worktreePath) =>
      shell?.revealWorktreePath ? shell.revealWorktreePath(worktreePath) : api.revealWorktreePath(worktreePath),
    removeStaleWorktree: (sessionPath) =>
      shell?.removeStaleWorktree ? shell.removeStaleWorktree(sessionPath) : api.removeStaleWorktree(sessionPath),
    archiveSessionWorktree: (sessionPath) =>
      shell?.archiveSessionWorktree
        ? shell.archiveSessionWorktree(sessionPath)
        : api.archiveSessionWorktree(sessionPath),
    pruneStaleWorktrees: () => (shell?.pruneStaleWorktrees ? shell.pruneStaleWorktrees() : api.pruneStaleWorktrees()),
    revealPreferencesDatabase: () =>
      shell?.revealPreferencesDatabase ? shell.revealPreferencesDatabase() : api.revealPreferencesDatabase(),
  };
}
