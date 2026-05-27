export type TurnState = "idle" | "running" | "completed";

export type SessionPhase = "idle" | "running" | "compacting" | "retrying";

export type ToolActivityState = "input-streaming" | "input-available" | "output-available" | "output-error";

export type ToolActivity = {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  content: unknown;
  isError: boolean;
  state: ToolActivityState;
  updatedAt: number;
};

export type SessionActivity = {
  id: string;
  type: string;
  detail: string;
  occurredAt: number;
};

export type SessionNotification = {
  id: string;
  message: string;
  notifyType: "info" | "warning" | "error";
  occurredAt: number;
};

export type SessionReadModel = {
  messages: unknown[];
  streamingMessage: unknown | null;
  tools: Record<string, ToolActivity>;
  queue: {
    steering: string[];
    followUp: string[];
  };
  phase: SessionPhase;
  latestTurn: {
    state: TurnState;
    startedAt: number | null;
  };
  isAgentRunning: boolean;
  isCompacting: boolean;
  retry: {
    active: boolean;
    attempt?: number;
    maxAttempts?: number;
    delayMs?: number;
    success?: boolean;
    errorMessage?: string;
  } | null;
  statusEntries: Record<string, string | undefined>;
  widgets: Record<string, string[] | undefined>;
  windowTitle: string | undefined;
  extensionError: string | undefined;
  streamingError: string | undefined;
  activities: SessionActivity[];
  notifications: SessionNotification[];
  needsDiffRefresh: boolean;
  needsRunHousekeeping: boolean;
};

export function createEmptySessionReadModel(): SessionReadModel {
  return {
    messages: [],
    streamingMessage: null,
    tools: {},
    queue: { steering: [], followUp: [] },
    phase: "idle",
    latestTurn: { state: "idle", startedAt: null },
    isAgentRunning: false,
    isCompacting: false,
    retry: null,
    statusEntries: {},
    widgets: {},
    windowTitle: undefined,
    extensionError: undefined,
    streamingError: undefined,
    activities: [],
    notifications: [],
    needsDiffRefresh: false,
    needsRunHousekeeping: false,
  };
}
