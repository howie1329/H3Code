declare global {
  type PiConnectionState = "disconnected" | "starting" | "connected" | "exited" | "error";

  type PiStatus = {
    state: PiConnectionState;
    repoPath?: string;
    diagnostic?: string;
  };

  type PiSessionSummary = {
    path: string;
    id: string;
    cwd: string;
    name?: string;
    created: string;
    modified: string;
    messageCount: number;
    firstMessage: string;
  };

  type PiSessionState = {
    model?: {
      provider?: string;
      id?: string;
      modelId?: string;
    };
    thinkingLevel: string;
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
    sessions: PiSessionSummary[];
    selectedSessionPath?: string;
    state?: PiSessionState;
    messages?: unknown[];
  };

  type DesktopSettings = {
    sidebarOpen: boolean;
    contextPanelOpen: boolean;
  };

  type RecentRepoPreference = {
    path: string;
    name: string;
    lastOpenedAt: string;
    lastSessionPath?: string;
  };

  type IndexedSessionPreference = {
    path: string;
    repoPath: string;
    id: string;
    name?: string;
    created: string;
    modified: string;
    messageCount: number;
    firstMessage: string;
  };

  type DesktopPreferences = {
    recentRepos: RecentRepoPreference[];
    indexedSessions: IndexedSessionPreference[];
    lastSelectedRepoPath?: string;
    lastSelectedSessionPath?: string;
    desktopSettings: DesktopSettings;
    databasePath: string;
  };

  interface Window {
    h3code?: {
      platform: NodeJS.Platform;
      selectRepo: () => Promise<{ path: string } | null>;
      connectRepo: (repoPath: string, selectedSessionPath?: string) => Promise<PiConnectRepoResult>;
      listSessions: () => Promise<PiSessionSummary[]>;
      listRepoSessions: (repoPath: string, markRecent?: boolean) => Promise<PiSessionSummary[]>;
      deletePiSession: (repoPath: string, sessionPath: string) => Promise<PiSessionSummary[]>;
      switchSession: (sessionPath: string) => Promise<{ state: PiSessionState; messages: unknown[] }>;
      newSession: (parentSession?: string) => Promise<{ state: PiSessionState; messages: unknown[] }>;
      getSessionStats: () => Promise<PiSessionStats | null>;
      getSessionDiff: () => Promise<PiSessionDiff>;
      getCommands: () => Promise<PiSlashCommand[]>;
      sendPrompt: (message: string, streamingBehavior?: "steer" | "followUp") => Promise<void>;
      abort: () => Promise<void>;
      getPreferences: () => Promise<DesktopPreferences>;
      removeIndexedRepo: (repoPath: string) => Promise<DesktopPreferences>;
      updateDesktopSettings: (settings: Partial<DesktopSettings>) => Promise<DesktopSettings>;
      onPiEvent: (listener: (event: unknown) => void) => () => void;
      onPiStatus: (listener: (status: PiStatus) => void) => () => void;
    };
  }
}

export {};
