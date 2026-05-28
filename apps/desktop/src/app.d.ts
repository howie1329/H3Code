declare global {
  type PiConnectionState = "disconnected" | "starting" | "connected" | "exited" | "error";

  type PiStatus = {
    state: PiConnectionState;
    agentId?: string;
    repoPath?: string;
    worktreePath?: string;
    diagnostic?: string;
  };

  type PiSessionSummary = {
    path: string;
    id: string;
    cwd: string;
    agentId?: string;
    worktreePath?: string;
    name?: string;
    created: string;
    modified: string;
    messageCount: number;
    firstMessage: string;
  };

  type PiThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

  type PiModel = {
    id: string;
    name?: string;
    provider: string;
    modelId?: string;
    reasoning?: boolean;
  };

  type PiSessionState = {
    model?: PiModel;
    thinkingLevel: PiThinkingLevel | string;
    isStreaming: boolean;
    isCompacting: boolean;
    steeringMode: "all" | "one-at-a-time";
    followUpMode: "all" | "one-at-a-time";
    sessionFile?: string;
    sessionId: string;
    sessionName?: string;
    autoCompactionEnabled: boolean;
    messageCount: number;
    pendingMessageCount: number;
  };

  type PiSessionStats = {
    sessionFile?: string;
    sessionId: string;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    toolResults: number;
    totalMessages: number;
    tokens: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      total: number;
    };
    cost: number;
    contextUsage?: {
      tokens: number | null;
      contextWindow: number;
      percent: number | null;
    };
  };

  type PiSessionDiff = {
    patch: string;
    changedFiles: number;
  };

  type PiWorktreeSummary = {
    sessionPath: string;
    repoPath: string;
    repoName: string;
    worktreePath: string;
    sessionId?: string;
    sessionName?: string;
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

  type PiWorktreeCleanupResult = {
    worktrees: PiWorktreeSummary[];
    removed: number;
  };

  type PiWorktreeArchiveResult = {
    worktrees: PiWorktreeSummary[];
    preferences: DesktopPreferences;
  };

  type PiSlashCommand = {
    name: string;
    description?: string;
    source: "extension" | "prompt" | "skill";
    location?: string;
    path?: string;
    sourceInfo?: {
      path?: string;
      source?: string;
      scope?: string;
      origin?: string;
      baseDir?: string;
    };
  };

  type PiConnectRepoResult = {
    repoPath: string;
    agentId?: string;
    worktreePath?: string;
    sessions: PiSessionSummary[];
    selectedSessionPath?: string;
    state?: PiSessionState;
    messages?: unknown[];
  };

  type PiQueueMode = "all" | "one-at-a-time";

  type DesktopSettings = {
    sidebarOpen: boolean;
    contextPanelOpen: boolean;
    preferDiffPanel: boolean;
    autoConnectOnLaunch: boolean;
  };

  type RecentRepoPreference = {
    path: string;
    name: string;
    addedAt: string;
    lastOpenedAt: string;
    lastSessionPath?: string;
    sessionsIndexedAt?: string;
  };

  type IndexedSessionPreference = {
    path: string;
    repoPath: string;
    worktreePath?: string;
    id: string;
    name?: string;
    created: string;
    modified: string;
    lastOpenedAt?: string;
    messageCount: number;
    firstMessage: string;
  };

  type PiExtensionUiRequest =
    | {
        type: "extension_ui_request";
        id: string;
        agentId?: string;
        method: "select";
        title: string;
        options: string[];
        timeout?: number;
      }
    | {
        type: "extension_ui_request";
        id: string;
        agentId?: string;
        method: "confirm";
        title: string;
        message: string;
        timeout?: number;
      }
    | {
        type: "extension_ui_request";
        id: string;
        agentId?: string;
        method: "input";
        title: string;
        placeholder?: string;
        timeout?: number;
      }
    | {
        type: "extension_ui_request";
        id: string;
        agentId?: string;
        method: "editor";
        title: string;
        prefill?: string;
      };

  type PiExtensionUiResponse =
    | { type: "extension_ui_response"; id: string; value: string }
    | { type: "extension_ui_response"; id: string; confirmed: boolean }
    | { type: "extension_ui_response"; id: string; cancelled: true };

  type DesktopPreferences = {
    recentRepos: RecentRepoPreference[];
    indexedSessions: IndexedSessionPreference[];
    lastSelectedRepoPath?: string;
    lastSelectedSessionPath?: string;
    desktopSettings: DesktopSettings;
    databasePath: string;
    piExecutablePath: string;
  };

  type AgentTransport = "ipc" | "ws";

  interface Window {
    h3code?: {
      platform: NodeJS.Platform;
      getAgentServerUrl: () => Promise<string | undefined>;
      getAgentTransport: () => AgentTransport;
      shell?: {
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
      getAppVersion: () => Promise<string>;
      pickExecutable: () => Promise<{ path: string } | null>;
      selectRepo: () => Promise<{ path: string } | null>;
      connectRepo: (repoPath: string, selectedSessionPath?: string) => Promise<PiConnectRepoResult>;
      listSessions: () => Promise<PiSessionSummary[]>;
      listRepoSessions: (repoPath: string, markRecent?: boolean) => Promise<PiSessionSummary[]>;
      deletePiSession: (repoPath: string, sessionPath: string) => Promise<PiSessionSummary[]>;
      switchSession: (sessionPath: string) => Promise<{ state: PiSessionState; messages: unknown[]; agentId?: string; repoPath?: string; worktreePath?: string }>;
      newSession: (parentSession?: string) => Promise<{ state: PiSessionState; messages: unknown[]; agentId?: string; repoPath?: string; worktreePath?: string }>;
      getSessionSnapshot: () => Promise<{ state: PiSessionState; messages: unknown[] }>;
      getSessionState: () => Promise<PiSessionState>;
      getSessionStats: (worktreePath?: string) => Promise<PiSessionStats | null>;
      getSessionDiff: (worktreePath?: string) => Promise<PiSessionDiff>;
      revealWorktree: (worktreePath?: string) => Promise<string>;
      listWorktrees: () => Promise<PiWorktreeSummary[]>;
      revealWorktreePath: (worktreePath: string) => Promise<string>;
      removeStaleWorktree: (sessionPath: string) => Promise<PiWorktreeCleanupResult>;
      archiveSessionWorktree: (sessionPath: string) => Promise<PiWorktreeArchiveResult>;
      pruneStaleWorktrees: () => Promise<PiWorktreeCleanupResult>;
      getCommands: () => Promise<PiSlashCommand[]>;
      getAvailableModels: () => Promise<PiModel[]>;
      setModel: (provider: string, modelId: string) => Promise<PiModel>;
      setThinkingLevel: (level: PiThinkingLevel) => Promise<void>;
      setSteeringMode: (mode: PiQueueMode) => Promise<PiSessionState>;
      setFollowUpMode: (mode: PiQueueMode) => Promise<PiSessionState>;
      setAutoCompaction: (enabled: boolean) => Promise<PiSessionState>;
      sendPrompt: (message: string, streamingBehavior?: "steer" | "followUp") => Promise<void>;
      sendSteer: (message: string) => Promise<void>;
      sendFollowUp: (message: string) => Promise<void>;
      abort: () => Promise<void>;
      respondToExtensionUi: (response: PiExtensionUiResponse) => Promise<void>;
      getPreferences: () => Promise<DesktopPreferences>;
      removeIndexedRepo: (repoPath: string) => Promise<DesktopPreferences>;
      updateDesktopSettings: (settings: Partial<DesktopSettings>) => Promise<DesktopSettings>;
      setPiExecutablePath: (executablePath: string) => Promise<{ piExecutablePath: string }>;
      clearAllIndexedData: () => Promise<DesktopPreferences>;
      revealPreferencesDatabase: () => Promise<string>;
      onSessionEvent: (listener: (event: import("$lib/pi-session/domain-events.js").SessionDomainEvent & { agentId?: string }) => void) => () => void;
      onPiStatus: (listener: (status: PiStatus) => void) => () => void;
      onExtensionUiRequest: (listener: (request: PiExtensionUiRequest) => void) => () => void;
    };
  }
}

interface ImportMetaEnv {
  readonly VITE_H3CODE_AGENT_TRANSPORT?: AgentTransport;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
