export interface ProviderCapabilities {
  sessions: {
    list: boolean;
    create: boolean;
    switch: boolean;
    snapshot: boolean;
    rename: boolean;
  };
  runs: {
    stream: boolean;
    abort: boolean;
    steer: boolean;
    followUp: boolean;
    retry: boolean;
  };
  ui: {
    modelPicker: boolean;
    slashCommands: boolean;
    providerPrompts: boolean;
    approvals: boolean;
    compaction: boolean;
  };
  workspace: {
    localCwd: boolean;
    gitDiff: boolean;
    worktrees: boolean;
  };
}
