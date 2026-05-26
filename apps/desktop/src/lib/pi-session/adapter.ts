import type { SessionDomainEvent, SessionEventEnvelope } from "./domain-events.js";
import { getString, nowMs, toRecord } from "./utils.js";

let nextEventId = 1;

export function createSessionEventEnvelope(event: SessionDomainEvent): SessionEventEnvelope {
  return {
    ...event,
    id: `pi-session-${nextEventId++}`,
  };
}

export function piRpcToDomainEvents(raw: unknown): SessionDomainEvent[] {
  const record = toRecord(raw);
  const type = getString(record.type);

  if (!type) {
    return [];
  }

  const occurredAt = nowMs();

  if (type === "extension_ui_request") {
    return extensionUiToDomainEvents(record, occurredAt);
  }

  switch (type) {
    case "agent_start":
      return [{ type: "run.started", occurredAt }];

    case "agent_end": {
      const messages = record.messages;
      return [
        {
          type: "run.ended",
          messages: Array.isArray(messages) ? messages : undefined,
          occurredAt,
        },
      ];
    }

    case "turn_start":
      return [{ type: "turn.started", occurredAt }];

    case "turn_end":
      return [
        {
          type: "turn.completed",
          message: record.message,
          toolResults: Array.isArray(record.toolResults) ? record.toolResults : undefined,
          occurredAt,
        },
      ];

    case "message_start":
      return [
        {
          type: "message.streaming",
          phase: "start",
          message: record.message,
          occurredAt,
        },
      ];

    case "message_update": {
      const assistantEvent = toRecord(record.assistantMessageEvent);
      const deltaType = getString(assistantEvent.type);
      const errorMessage = getStreamingErrorMessage(record);

      return [
        {
          type: "message.streaming",
          phase: "update",
          message: getStreamingMessage(record),
          deltaType,
          errorMessage,
          occurredAt,
        },
      ];
    }

    case "message_end":
      return [
        {
          type: "message.streaming",
          phase: "end",
          message: record.message,
          occurredAt,
        },
      ];

    case "tool_execution_start":
      return [toolEvent(record, "start", occurredAt)];

    case "tool_execution_update":
      return [toolEvent(record, "update", occurredAt)];

    case "tool_execution_end":
      return [toolEvent(record, "end", occurredAt)];

    case "queue_update":
      return [
        {
          type: "queue.updated",
          steering: stringArray(record.steering),
          followUp: stringArray(record.followUp),
          occurredAt,
        },
      ];

    case "compaction_start":
      return [
        {
          type: "compaction.updated",
          phase: "start",
          reason: getString(record.reason),
          occurredAt,
        },
      ];

    case "compaction_end":
      return [
        {
          type: "compaction.updated",
          phase: "end",
          reason: getString(record.reason),
          aborted: record.aborted === true,
          errorMessage: getString(record.errorMessage),
          occurredAt,
        },
      ];

    case "auto_retry_start":
      return [
        {
          type: "retry.updated",
          phase: "start",
          attempt: numberOrUndefined(record.attempt),
          maxAttempts: numberOrUndefined(record.maxAttempts),
          delayMs: numberOrUndefined(record.delayMs),
          errorMessage: getString(record.errorMessage),
          occurredAt,
        },
      ];

    case "auto_retry_end":
      return [
        {
          type: "retry.updated",
          phase: "end",
          attempt: numberOrUndefined(record.attempt),
          success: record.success === true,
          errorMessage: getString(record.finalError) ?? getString(record.errorMessage),
          occurredAt,
        },
      ];

    case "extension_error":
      return [
        {
          type: "extension.error",
          message: formatExtensionError(record),
          extensionPath: getString(record.extensionPath),
          event: getString(record.event),
          occurredAt,
        },
      ];

    default:
      return [];
  }
}

export function piRpcToDomainEvent(raw: unknown): SessionDomainEvent | null {
  return piRpcToDomainEvents(raw)[0] ?? null;
}

function extensionUiToDomainEvents(record: Record<string, unknown>, occurredAt: number): SessionDomainEvent[] {
  const method = getString(record.method);

  if (method === "setStatus") {
    return [
      {
        type: "extension.status",
        statusKey: getString(record.statusKey) ?? "default",
        statusText: getString(record.statusText),
        occurredAt,
      },
    ];
  }

  if (method === "notify") {
    const notifyType = record.notifyType;
    return [
      {
        type: "extension.notify",
        message: getString(record.message) ?? "",
        notifyType:
          notifyType === "warning" || notifyType === "error" || notifyType === "info" ? notifyType : "info",
        occurredAt,
      },
    ];
  }

  if (method === "setWidget") {
    return [
      {
        type: "extension.widget",
        widgetKey: getString(record.widgetKey) ?? "default",
        widgetLines: Array.isArray(record.widgetLines)
          ? record.widgetLines.filter((line): line is string => typeof line === "string")
          : undefined,
        occurredAt,
      },
    ];
  }

  if (method === "setTitle") {
    return [
      {
        type: "extension.widget",
        widgetKey: "__title__",
        title: getString(record.title),
        occurredAt,
      },
    ];
  }

  return [];
}

function toolEvent(
  record: Record<string, unknown>,
  phase: "start" | "update" | "end",
  occurredAt: number,
): SessionDomainEvent {
  const toolCallId = getString(record.toolCallId) ?? `tool-${occurredAt}`;
  const partialResult = toRecord(record.partialResult);
  const result = toRecord(record.result);
  const isError = record.isError === true || (phase === "end" && result.isError === true);
  const content =
    phase === "update"
      ? partialResult.content
      : phase === "end"
        ? result.content
        : undefined;
  const errorText =
    getString(record.errorText) ?? getString(result.errorText) ?? getString(result.errorMessage);

  return {
    type: "tool.updated",
    phase,
    toolCallId,
    toolName: getString(record.toolName) ?? "tool",
    args: record.args,
    content: errorText ? [{ type: "text", text: errorText }] : content,
    isError,
    errorText,
    occurredAt,
  };
}

function getStreamingMessage(event: Record<string, unknown>) {
  if (event.message !== undefined) {
    return event.message;
  }

  const assistantEvent = toRecord(event.assistantMessageEvent);
  return assistantEvent.partial ?? assistantEvent.message ?? assistantEvent.error;
}

function getStreamingErrorMessage(event: Record<string, unknown>) {
  const assistantEvent = toRecord(event.assistantMessageEvent);

  if (assistantEvent.type !== "error") {
    return undefined;
  }

  const error = assistantEvent.error;

  if (typeof error === "string") {
    return error;
  }

  const errorRecord = toRecord(error);
  const errorMessage = errorRecord.errorMessage ?? errorRecord.message;

  return typeof errorMessage === "string" ? errorMessage : "PI streaming failed.";
}

function formatExtensionError(record: Record<string, unknown>) {
  const error = record.error;
  const extensionPath = getString(record.extensionPath);
  const event = getString(record.event);
  const message = typeof error === "string" ? error : String(error ?? "Extension error");
  const parts = [message];

  if (extensionPath) {
    parts.push(`(${extensionPath})`);
  }

  if (event) {
    parts.push(`during ${event}`);
  }

  return parts.join(" ");
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
