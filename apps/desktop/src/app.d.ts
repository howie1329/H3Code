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
    | { type: "extension_ui_response"; id: string; method?: "select" | "input" | "editor"; value: string }
    | { type: "extension_ui_response"; id: string; method?: "confirm"; confirmed: boolean }
    | { type: "extension_ui_response"; id: string; method?: PiExtensionUiRequest["method"]; cancelled: true };

  type DesktopPreferences = {
    recentRepos: RecentRepoPreference[];
    indexedSessions: IndexedSessionPreference[];
    lastSelectedRepoPath?: string;
    lastSelectedSessionPath?: string;
    desktopSettings: DesktopSettings;
    databasePath: string;
    piExecutablePath: string;
  };

  type SessionMessageCacheState = {
    isStreaming?: boolean;
    isCompacting?: boolean;
    sessionFile?: string;
    sessionId?: string;
  };

  type SessionMessageCacheEntry = {
    sessionPath: string;
    repoPath: string;
    providerId?: string;
    messages: unknown[];
    sessionState?: SessionMessageCacheState;
    messageCount: number;
    sourceMtimeMs?: number;
    sourceSizeBytes?: number;
    contentHash: string;
    cachedAt: string;
    syncedAt?: string;
    lastOpenedAt: string;
    syncStatus?: "fresh" | "stale" | "syncing" | "error";
  };

  type SessionMessageCacheUpsert = {
    sessionPath: string;
    repoPath: string;
    providerId?: string;
    messages: unknown[];
    sessionState?: SessionMessageCacheState;
    messageCount?: number;
    sourceMtimeMs?: number;
    sourceSizeBytes?: number;
    contentHash?: string;
    cachedAt?: string;
    syncedAt?: string;
    lastOpenedAt?: string;
    syncStatus?: "fresh" | "stale" | "syncing" | "error";
  };

  interface Window {
    h3code?: {
      platform: NodeJS.Platform;
      getAgentServerUrl: () => Promise<string | undefined>;
      getAppVersion: () => Promise<string>;
      selectRepo: () => Promise<{ path: string } | null>;
      revealPath: (targetPath: string) => Promise<string>;
      revealPreferencesDatabase: () => Promise<string>;
      getSessionMessageCache: (sessionPath: string) => Promise<SessionMessageCacheEntry | undefined>;
      upsertSessionMessageCache: (input: SessionMessageCacheUpsert) => Promise<void>;
      deleteSessionMessageCache: (sessionPath: string) => Promise<void>;
    };
  }
}

export {};
