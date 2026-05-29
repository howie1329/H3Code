export interface ProviderCapabilities {
  sessions: {
    list: boolean;
    create: boolean;
    switch: boolean;
    snapshot: boolean;
    fork: boolean;
    import: boolean;
  };
  runs: {
    stream: boolean;
    abort: boolean;
    steer: boolean;
    followUp: boolean;
    retry: boolean;
  };
  ui: {
    model: boolean;
    thinkingLevel: boolean;
    extensionUi: boolean;
    compaction: boolean;
    commands: boolean;
    modelsList: boolean;
    queueSettings: boolean;
  };
  workspace: {
    localCwd: boolean;
  };
}
