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

  type PiConnectRepoResult = {
    repoPath: string;
    sessions: PiSessionSummary[];
    selectedSessionPath?: string;
    state?: PiSessionState;
    messages?: unknown[];
  };

  interface Window {
    h3code?: {
      platform: NodeJS.Platform;
      selectRepo: () => Promise<{ path: string } | null>;
      connectRepo: (repoPath: string, selectedSessionPath?: string) => Promise<PiConnectRepoResult>;
      listSessions: () => Promise<PiSessionSummary[]>;
      listRepoSessions: (repoPath: string) => Promise<PiSessionSummary[]>;
      switchSession: (sessionPath: string) => Promise<{ state: PiSessionState; messages: unknown[] }>;
      newSession: (parentSession?: string) => Promise<{ state: PiSessionState; messages: unknown[] }>;
      getSessionStats: () => Promise<PiSessionStats | null>;
      sendPrompt: (message: string, streamingBehavior?: "steer" | "followUp") => Promise<void>;
      abort: () => Promise<void>;
      onPiEvent: (listener: (event: unknown) => void) => () => void;
      onPiStatus: (listener: (status: PiStatus) => void) => () => void;
    };
  }
}

export {};
