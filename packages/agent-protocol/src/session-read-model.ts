import type { ActivityId, MessageId, ProviderId, ProviderSessionRef, RepoPath, RequestId, RuntimeItemId, SessionId, TurnId } from "./ids.js";

export type SessionStatus = "idle" | "running" | "error";

export type SessionReadModel = {
  id: SessionId;
  providerId: ProviderId;
  repoPath: RepoPath;
  providerSessionRef?: ProviderSessionRef;
  status: SessionStatus;
  activeTurnId?: TurnId;
  title?: string;
  messages: UiMessage[];
  activities: UiActivity[];
  pendingInteractions: PendingInteraction[];
  model?: UiModelState;
  thinkingLevel?: string;
  queueSettings?: UiQueueSettings;
  autoCompactionEnabled?: boolean;
  tokenUsage?: TokenUsageSnapshot;
  diffSummary?: WorkspaceDiffSummary;
  updatedAt: number;
};

export type UiMessage = {
  id: MessageId;
  sessionId: SessionId;
  turnId?: TurnId;
  role: "user" | "assistant" | "system";
  content: string;
  status?: "streaming" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
};

export type UiActivity = {
  id: ActivityId;
  sessionId: SessionId;
  turnId?: TurnId;
  itemId?: RuntimeItemId;
  kind: "reasoning" | "tool" | "command" | "file_change" | "web_search" | "plan" | "error";
  title?: string;
  content?: string;
  status: "pending" | "running" | "completed" | "failed";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
};

export type PendingInteraction = {
  id: RequestId;
  sessionId: SessionId;
  turnId?: TurnId;
  itemId?: RuntimeItemId;
  kind: "approval" | "user_input";
  payload: unknown;
  createdAt: number;
};

export type UiModelState = {
  id?: string;
  name?: string;
  providerId?: ProviderId;
  provider?: string;
  modelId?: string;
  reasoning?: boolean;
};

export type UiQueueSettings = {
  steeringMode?: "all" | "one-at-a-time";
  followUpMode?: "all" | "one-at-a-time";
};

export type TokenUsageSnapshot = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  details?: Record<string, unknown>;
};

export type WorkspaceDiffSummary = {
  changedFiles: number;
  additions?: number;
  deletions?: number;
  files?: WorkspaceDiffFile[];
};

export type WorkspaceDiffFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  additions?: number;
  deletions?: number;
};

export type SessionReadModelPatch = {
  status?: SessionStatus;
  activeTurnId?: TurnId | null;
  title?: string | null;
  messages?: UiMessage[];
  activities?: UiActivity[];
  pendingInteractions?: PendingInteraction[];
  model?: UiModelState | null;
  thinkingLevel?: string | null;
  queueSettings?: UiQueueSettings | null;
  autoCompactionEnabled?: boolean | null;
  tokenUsage?: TokenUsageSnapshot | null;
  diffSummary?: WorkspaceDiffSummary | null;
  updatedAt: number;
};
