export type MessageStreamPhase = "start" | "update" | "end";

export type ToolStreamPhase = "start" | "update" | "end";

export type CompactionPhase = "start" | "end";

export type RetryPhase = "start" | "end";

export type SessionDomainEvent =
  | { type: "run.started"; occurredAt: number }
  | { type: "run.ended"; messages?: unknown[]; occurredAt: number }
  | { type: "run.failed"; errorMessage: string; occurredAt: number }
  | { type: "turn.started"; occurredAt: number }
  | {
      type: "turn.completed";
      message?: unknown;
      toolResults?: unknown[];
      occurredAt: number;
    }
  | {
      type: "message.streaming";
      phase: MessageStreamPhase;
      message?: unknown;
      deltaType?: string;
      errorMessage?: string;
      occurredAt: number;
    }
  | {
      type: "tool.updated";
      phase: ToolStreamPhase;
      toolCallId: string;
      toolName: string;
      args?: unknown;
      content?: unknown;
      isError?: boolean;
      errorText?: string;
      occurredAt: number;
    }
  | {
      type: "queue.updated";
      steering: string[];
      followUp: string[];
      occurredAt: number;
    }
  | {
      type: "compaction.updated";
      phase: CompactionPhase;
      reason?: string;
      aborted?: boolean;
      errorMessage?: string;
      occurredAt: number;
    }
  | {
      type: "retry.updated";
      phase: RetryPhase;
      attempt?: number;
      maxAttempts?: number;
      delayMs?: number;
      success?: boolean;
      errorMessage?: string;
      occurredAt: number;
    }
  | {
      type: "extension.error";
      message: string;
      extensionPath?: string;
      event?: string;
      occurredAt: number;
    }
  | {
      type: "extension.status";
      statusKey: string;
      statusText?: string;
      occurredAt: number;
    }
  | {
      type: "extension.notify";
      message: string;
      notifyType?: "info" | "warning" | "error";
      occurredAt: number;
    }
  | {
      type: "extension.widget";
      widgetKey: string;
      widgetLines?: string[];
      title?: string;
      occurredAt: number;
    };

export type SessionEventEnvelope = SessionDomainEvent & {
  id: string;
};
