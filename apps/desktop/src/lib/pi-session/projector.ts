import type { SessionDomainEvent } from "./domain-events.js";
import {
  createEmptySessionReadModel,
  type SessionActivity,
  type SessionReadModel,
  type ToolActivity,
} from "./read-model.js";
import { cloneValue, explicitMessageIdentity, getString, messageContentSignature, toRecord } from "./utils.js";

const MAX_ACTIVITIES = 40;
const MAX_NOTIFICATIONS = 8;

export function applySessionEvent(model: SessionReadModel, event: SessionDomainEvent): SessionReadModel {
  const next = cloneModel(model);
  next.needsDiffRefresh = false;
  next.needsRunHousekeeping = false;

  switch (event.type) {
    case "run.started":
      return applyRunStarted(next, event.occurredAt);

    case "run.ended":
      return applyRunEnded(next, event.messages, event.occurredAt);

    case "run.failed":
      return applyRunFailed(next, event.errorMessage, event.occurredAt);

    case "turn.started":
      return applyTurnStarted(next, event.occurredAt);

    case "turn.completed":
      return applyTurnCompleted(next, event.message, event.toolResults, event.occurredAt);

    case "message.streaming":
      return applyMessageStreaming(next, event);

    case "tool.updated":
      return applyToolUpdated(next, event);

    case "queue.updated":
      next.queue = {
        steering: [...event.steering],
        followUp: [...event.followUp],
      };
      return pushActivity(next, "queue", `${event.steering.length} steering, ${event.followUp.length} follow-up`, event.occurredAt);

    case "compaction.updated":
      return applyCompactionUpdated(next, event);

    case "retry.updated":
      return applyRetryUpdated(next, event);

    case "extension.error":
      next.extensionError = event.message;
      return pushActivity(next, "extension.error", event.message, event.occurredAt);

    case "extension.status":
      next.statusEntries = {
        ...next.statusEntries,
        [event.statusKey]: event.statusText,
      };
      return pushActivity(next, "extension.status", `${event.statusKey}: ${event.statusText ?? "(cleared)"}`, event.occurredAt);

    case "extension.notify":
      return pushNotification(next, event.message, event.notifyType ?? "info", event.occurredAt);

    case "extension.widget":
      return applyExtensionWidget(next, event);

    default:
      return next;
  }
}

export function hydrateFromSnapshot(
  model: SessionReadModel,
  state: unknown,
  messages: unknown[],
): SessionReadModel {
  const next = cloneModel(model);
  const stateRecord = toRecord(state);

  next.messages = [...messages];
  next.streamingMessage = null;
  next.tools = {};
  next.isAgentRunning = stateRecord.isStreaming === true;
  next.isCompacting = stateRecord.isCompacting === true;
  next.phase = next.isCompacting ? "compacting" : next.isAgentRunning ? "running" : "idle";
  next.latestTurn = {
    state: next.isAgentRunning ? "running" : "idle",
    startedAt: next.isAgentRunning ? Date.now() : null,
  };
  next.retry = null;
  next.streamingError = undefined;
  next.needsDiffRefresh = false;
  next.needsRunHousekeeping = false;

  return next;
}

export function createInitialSessionReadModel(): SessionReadModel {
  return createEmptySessionReadModel();
}

function applyRunStarted(model: SessionReadModel, occurredAt: number): SessionReadModel {
  model.isAgentRunning = true;
  model.phase = "running";
  model.streamingMessage = null;
  model.streamingError = undefined;
  model.tools = {};
  model.latestTurn = { state: "running", startedAt: occurredAt };
  return pushActivity(model, "run.started", "Agent run started", occurredAt);
}

function applyRunEnded(model: SessionReadModel, messages: unknown[] | undefined, occurredAt: number): SessionReadModel {
  if (Array.isArray(messages) && messages.length > 0) {
    model.messages = [...messages];
  }

  model.isAgentRunning = false;
  model.phase = model.isCompacting ? "compacting" : "idle";
  model.streamingMessage = null;
  model.streamingError = undefined;
  model.tools = {};
  model.latestTurn = { state: "idle", startedAt: null };
  model.needsRunHousekeeping = true;
  return pushActivity(model, "run.ended", "Agent run ended", occurredAt);
}

function applyRunFailed(model: SessionReadModel, errorMessage: string, occurredAt: number): SessionReadModel {
  model.isAgentRunning = false;
  model.phase = model.isCompacting ? "compacting" : "idle";
  model.streamingMessage = null;
  model.streamingError = errorMessage;
  model.tools = {};
  model.latestTurn = { state: "idle", startedAt: null };
  model.needsRunHousekeeping = true;
  return pushActivity(model, "run.failed", errorMessage, occurredAt);
}

function applyTurnStarted(model: SessionReadModel, occurredAt: number): SessionReadModel {
  model.latestTurn = { state: "running", startedAt: occurredAt };
  return pushActivity(model, "turn.started", "Turn started", occurredAt);
}

function applyTurnCompleted(
  model: SessionReadModel,
  message: unknown,
  toolResults: unknown[] | undefined,
  occurredAt: number,
): SessionReadModel {
  if (message !== undefined) {
    model.messages = appendUniqueMessage(model.messages, message);
  }

  if (Array.isArray(toolResults)) {
    for (const toolResult of toolResults) {
      model.messages = appendUniqueMessage(model.messages, toolResult);
    }
  }

  model.streamingMessage = null;
  model.tools = {};
  model.latestTurn = { state: "completed", startedAt: model.latestTurn.startedAt };
  model.needsDiffRefresh = true;
  return pushActivity(model, "turn.completed", "Turn completed", occurredAt);
}

function applyMessageStreaming(
  model: SessionReadModel,
  event: Extract<SessionDomainEvent, { type: "message.streaming" }>,
): SessionReadModel {
  if (event.errorMessage) {
    model.streamingError = event.errorMessage;
  }

  if (event.phase === "start" && event.message !== undefined) {
    model.streamingMessage = enrichStreamingMessage(event.message, event.deltaType);
    return pushActivity(model, "message.start", "Assistant message started", event.occurredAt);
  }

  if (event.phase === "update" && event.message !== undefined) {
    model.streamingMessage = enrichStreamingMessage(event.message, event.deltaType);
    return model;
  }

  if (event.phase === "end" && event.message !== undefined) {
    model.messages = appendUniqueMessage(model.messages, event.message);
    model.streamingMessage = null;
    model.streamingError = undefined;
    return pushActivity(model, "message.end", "Assistant message completed", event.occurredAt);
  }

  return model;
}

function applyToolUpdated(
  model: SessionReadModel,
  event: Extract<SessionDomainEvent, { type: "tool.updated" }>,
): SessionReadModel {
  const existing = model.tools[event.toolCallId];
  const nextTool: ToolActivity = {
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    args: event.args ?? existing?.args,
    content: event.content ?? existing?.content ?? [],
    isError: event.isError ?? existing?.isError ?? false,
    state:
      event.phase === "start"
        ? "input-streaming"
        : event.phase === "update"
          ? "input-available"
          : event.isError
            ? "output-error"
            : "output-available",
    updatedAt: event.occurredAt,
  };

  model.tools = {
    ...model.tools,
    [event.toolCallId]: nextTool,
  };

  if (event.phase === "end") {
    const { [event.toolCallId]: _removed, ...remaining } = model.tools;
    model.tools = remaining;
    model.messages = appendUniqueMessage(model.messages, createToolExecutionMessage(nextTool));
  }

  const detail =
    event.phase === "start"
      ? `Running ${event.toolName}`
      : event.phase === "update"
        ? `Streaming ${event.toolName}`
        : event.isError
          ? `${event.toolName} failed`
          : `${event.toolName} completed`;

  return pushActivity(model, `tool.${event.phase}`, detail, event.occurredAt);
}

function applyCompactionUpdated(
  model: SessionReadModel,
  event: Extract<SessionDomainEvent, { type: "compaction.updated" }>,
): SessionReadModel {
  if (event.phase === "start") {
    model.isCompacting = true;
    model.phase = "compacting";
    return pushActivity(model, "compaction.start", event.reason ?? "Compacting context", event.occurredAt);
  }

  model.isCompacting = false;
  model.phase = model.isAgentRunning ? "running" : "idle";

  const detail = event.errorMessage
    ? `Compaction failed: ${event.errorMessage}`
    : event.aborted
      ? "Compaction aborted"
      : "Compaction finished";

  return pushActivity(model, "compaction.end", detail, event.occurredAt);
}

function applyRetryUpdated(
  model: SessionReadModel,
  event: Extract<SessionDomainEvent, { type: "retry.updated" }>,
): SessionReadModel {
  if (event.phase === "start") {
    model.retry = {
      active: true,
      attempt: event.attempt,
      maxAttempts: event.maxAttempts,
      delayMs: event.delayMs,
      errorMessage: event.errorMessage,
    };
    model.phase = "retrying";
    const attemptLabel =
      event.attempt !== undefined && event.maxAttempts !== undefined
        ? `Retry ${event.attempt}/${event.maxAttempts}`
        : "Retrying";
    return pushActivity(model, "retry.start", attemptLabel, event.occurredAt);
  }

  model.retry = {
    active: false,
    attempt: event.attempt,
    success: event.success,
    errorMessage: event.errorMessage,
  };
  model.phase = model.isCompacting ? "compacting" : model.isAgentRunning ? "running" : "idle";

  const detail = event.success ? "Retry succeeded" : event.errorMessage ?? "Retry finished";
  return pushActivity(model, "retry.end", detail, event.occurredAt);
}

function applyExtensionWidget(
  model: SessionReadModel,
  event: Extract<SessionDomainEvent, { type: "extension.widget" }>,
): SessionReadModel {
  if (event.widgetKey === "__title__") {
    model.windowTitle = event.title;
    return pushActivity(model, "extension.title", event.title ?? "(cleared)", event.occurredAt);
  }

  model.widgets = {
    ...model.widgets,
    [event.widgetKey]: event.widgetLines,
  };

  const lineCount = event.widgetLines?.length ?? 0;
  return pushActivity(model, "extension.widget", `${event.widgetKey}: ${lineCount} lines`, event.occurredAt);
}

function enrichStreamingMessage(message: unknown, deltaType?: string) {
  const record = toRecord(cloneValue(message));
  if (deltaType) {
    record.__streamDeltaType = deltaType;
  }
  return record;
}

function createToolExecutionMessage(tool: ToolActivity) {
  return {
    role: "toolExecution",
    toolCallId: tool.toolCallId,
    toolName: tool.toolName,
    args: tool.args,
    content: tool.content,
    isError: tool.isError,
    state: tool.state,
  };
}

function appendUniqueMessage(messages: unknown[], message: unknown): unknown[] {
  const explicitId = explicitMessageIdentity(message);
  const index = explicitId
    ? messages.findIndex((entry) => explicitMessageIdentity(entry) === explicitId)
    : findRecentMessageBySignature(messages, message);

  if (index === -1) {
    return [...messages, cloneValue(message)];
  }

  const next = [...messages];
  next[index] = cloneValue(message);
  return next;
}

function findRecentMessageBySignature(messages: unknown[], message: unknown): number {
  const signature = messageContentSignature(message);

  if (!signature) {
    return -1;
  }

  for (let index = messages.length - 1; index >= Math.max(0, messages.length - 4); index -= 1) {
    if (!explicitMessageIdentity(messages[index]) && messageContentSignature(messages[index]) === signature) {
      return index;
    }
  }

  return -1;
}

function pushActivity(model: SessionReadModel, type: string, detail: string, occurredAt: number): SessionReadModel {
  const activity: SessionActivity = {
    id: `${type}-${occurredAt}-${model.activities.length}`,
    type,
    detail,
    occurredAt,
  };

  model.activities = [activity, ...model.activities].slice(0, MAX_ACTIVITIES);
  return model;
}

function pushNotification(
  model: SessionReadModel,
  message: string,
  notifyType: "info" | "warning" | "error",
  occurredAt: number,
): SessionReadModel {
  const notification = {
    id: `notify-${occurredAt}-${model.notifications.length}`,
    message,
    notifyType,
    occurredAt,
  };

  model.notifications = [notification, ...model.notifications].slice(0, MAX_NOTIFICATIONS);
  return pushActivity(model, "extension.notify", message, occurredAt);
}

export function cloneSessionReadModel(model: SessionReadModel): SessionReadModel {
  return cloneModel(model);
}

function cloneModel(model: SessionReadModel): SessionReadModel {
  return {
    ...model,
    messages: [...model.messages],
    tools: { ...model.tools },
    queue: {
      steering: [...model.queue.steering],
      followUp: [...model.queue.followUp],
    },
    latestTurn: { ...model.latestTurn },
    statusEntries: { ...model.statusEntries },
    widgets: { ...model.widgets },
    activities: [...model.activities],
    notifications: [...model.notifications],
    retry: model.retry ? { ...model.retry } : null,
    streamingMessage: model.streamingMessage ? cloneValue(model.streamingMessage) : null,
  };
}
