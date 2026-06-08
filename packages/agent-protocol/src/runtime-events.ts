import type { ProviderModel, ProviderQueueMode } from "./providers.js";
import type { ProviderId, ProviderSessionRef, RepoPath, RequestId, RuntimeItemId, SessionId, TurnId } from "./ids.js";

export type RuntimeEvent =
  | SessionStartedEvent
  | SessionUpdatedEvent
  | SessionEndedEvent
  | TurnStartedEvent
  | TurnCompletedEvent
  | ItemStartedEvent
  | ContentDeltaEvent
  | ToolUpdatedEvent
  | ApprovalRequestedEvent
  | UserInputRequestedEvent
  | RuntimeErrorEvent;

export type RuntimeEventBase<Type extends string> = {
  type: Type;
  sessionId: SessionId;
  providerId: ProviderId;
  occurredAt: number;
  sequence?: number;
};

export type RuntimeSessionStatus = "starting" | "running" | "idle" | "stopped" | "error";

export type SessionStartedEvent = RuntimeEventBase<"session.started"> & {
  repoPath?: RepoPath;
  providerSessionRef?: ProviderSessionRef;
  resumeCursor?: unknown;
  model?: string;
  modelState?: ProviderModel;
  thinkingLevel?: string;
  queueSettings?: {
    steeringMode?: ProviderQueueMode;
    followUpMode?: ProviderQueueMode;
  };
  autoCompactionEnabled?: boolean;
};

export type SessionUpdatedEvent = RuntimeEventBase<"session.updated"> & {
  status?: RuntimeSessionStatus;
  providerSessionRef?: ProviderSessionRef;
  resumeCursor?: unknown;
  model?: string;
  modelState?: ProviderModel;
  thinkingLevel?: string;
  queueSettings?: {
    steeringMode?: ProviderQueueMode;
    followUpMode?: ProviderQueueMode;
  };
  autoCompactionEnabled?: boolean;
  title?: string;
  metadata?: Record<string, unknown>;
};

export type SessionEndedEvent = RuntimeEventBase<"session.ended"> & {
  status: "completed" | "failed" | "cancelled" | "interrupted";
  reason?: string;
};

export type TurnStartedEvent = RuntimeEventBase<"turn.started"> & {
  turnId: TurnId;
  model?: string;
};

export type TurnCompletedEvent = RuntimeEventBase<"turn.completed"> & {
  turnId: TurnId;
  status: "completed" | "failed" | "cancelled" | "interrupted";
  usage?: unknown;
};

export type RuntimeItemType =
  | "assistant_message"
  | "reasoning"
  | "command_execution"
  | "file_change"
  | "dynamic_tool_call"
  | "web_search"
  | "plan"
  | "error";

export type ItemStartedEvent = RuntimeEventBase<"item.started"> & {
  turnId: TurnId;
  itemId: RuntimeItemId;
  itemType: RuntimeItemType;
  title?: string;
};

export type ContentStream = "assistant_text" | "reasoning_text" | "tool_output";

export type ContentDeltaEvent = RuntimeEventBase<"content.delta"> & {
  turnId: TurnId;
  itemId: RuntimeItemId;
  stream: ContentStream;
  delta: string;
};

export type ToolStatus = "pending" | "running" | "completed" | "failed";

export type ToolUpdatedEvent = RuntimeEventBase<"tool.updated"> & {
  turnId?: TurnId;
  itemId: RuntimeItemId;
  toolName: string;
  status: ToolStatus;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export type ApprovalRequestedEvent = RuntimeEventBase<"approval.requested"> & {
  requestId: RequestId;
  turnId?: TurnId;
  itemId?: RuntimeItemId;
  payload: unknown;
};

export type UserInputRequestedEvent = RuntimeEventBase<"user_input.requested"> & {
  requestId: RequestId;
  turnId?: TurnId;
  itemId?: RuntimeItemId;
  payload: unknown;
};

export type RuntimeErrorEvent = RuntimeEventBase<"runtime.error"> & {
  turnId?: TurnId;
  itemId?: RuntimeItemId;
  code?: string;
  message: string;
  recoverable?: boolean;
  cause?: unknown;
};
