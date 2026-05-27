import type { MessageId, RunRef, ToolCallId } from "./ids.js";
import type { RunStatus, RunSummary, TranscriptMessage } from "./sessions.js";

export interface ApprovalRequest {
  id: string;
  title: string;
  message?: string;
  details?: unknown;
}

export type SessionDomainEvent =
  | { type: "run.started"; run: RunSummary; occurredAt: number }
  | { type: "run.updated"; runRef: RunRef; status: RunStatus; occurredAt: number }
  | {
      type: "run.completed";
      runRef: RunRef;
      status: "completed" | "failed" | "aborted";
      occurredAt: number;
    }
  | { type: "message.added"; message: TranscriptMessage; occurredAt: number }
  | { type: "message.delta"; messageId: MessageId; delta: unknown; occurredAt: number }
  | { type: "tool.started"; toolCallId: ToolCallId; name: string; input?: unknown; occurredAt: number }
  | { type: "tool.updated"; toolCallId: ToolCallId; delta?: unknown; occurredAt: number }
  | { type: "tool.completed"; toolCallId: ToolCallId; output?: unknown; isError?: boolean; occurredAt: number }
  | { type: "approval.requested"; approval: ApprovalRequest; occurredAt: number }
  | {
      type: "approval.resolved";
      approvalId: string;
      decision: "approved" | "rejected";
      occurredAt: number;
    }
  | {
      type: "provider.notice";
      level: "info" | "warning" | "error";
      message: string;
      occurredAt: number;
    };
