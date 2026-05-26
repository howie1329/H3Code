import type { SessionReadModel, ToolActivity } from "./read-model.js";
import { getString, messageIdentity, toRecord } from "./utils.js";

export type ComposerPhaseLine = {
  tone: "neutral" | "working" | "warning" | "error";
  text: string;
};

export function transcriptMessages(model: SessionReadModel, pendingUserMessages: unknown[] = []): unknown[] {
  const committedIds = new Set(model.messages.map((message) => messageIdentity(message, "")));
  const extras: unknown[] = [];

  if (model.streamingMessage) {
    const streamingId = messageIdentity(model.streamingMessage, "__streaming__");
    if (!committedIds.has(streamingId)) {
      extras.push(model.streamingMessage);
    }
  }

  for (const tool of Object.values(model.tools)) {
    extras.push(createLiveToolMessage(tool));
  }

  return [...model.messages, ...pendingUserMessages, ...extras];
}

export function composerPhase(model: SessionReadModel): ComposerPhaseLine | null {
  if (model.streamingError) {
    return { tone: "error", text: model.streamingError };
  }

  if (model.extensionError) {
    return { tone: "error", text: model.extensionError };
  }

  if (model.isCompacting) {
    return { tone: "working", text: "Compacting context…" };
  }

  if (model.retry?.active) {
    const attempt =
      model.retry.attempt !== undefined && model.retry.maxAttempts !== undefined
        ? `Retry ${model.retry.attempt}/${model.retry.maxAttempts}`
        : "Retrying";
    const delay =
      model.retry.delayMs !== undefined ? ` in ${Math.round(model.retry.delayMs / 1000)}s` : "";
    return { tone: "warning", text: `${attempt}${delay}` };
  }

  const activeTool = Object.values(model.tools).find((tool) => tool.state !== "output-available");
  if (activeTool) {
    return { tone: "working", text: `Running ${activeTool.toolName}…` };
  }

  if (model.streamingMessage) {
    const deltaType = getString(toRecord(model.streamingMessage).__streamDeltaType);
    if (deltaType === "thinking") {
      return { tone: "working", text: "Thinking…" };
    }
    return { tone: "working", text: "Writing response…" };
  }

  if (model.isAgentRunning) {
    return { tone: "working", text: "Pi is working…" };
  }

  const queuedCount = model.queue.steering.length + model.queue.followUp.length;
  if (queuedCount > 0) {
    return {
      tone: "neutral",
      text: `${queuedCount} queued message${queuedCount === 1 ? "" : "s"}`,
    };
  }

  return null;
}

export function statusStripLines(model: SessionReadModel): string[] {
  const lines: string[] = [];

  const phase = composerPhase(model);
  if (phase) {
    lines.push(phase.text);
  }

  for (const [key, value] of Object.entries(model.statusEntries)) {
    if (value) {
      lines.push(`${key}: ${value}`);
    }
  }

  for (const [key, widgetLines] of Object.entries(model.widgets)) {
    if (widgetLines?.length) {
      lines.push(`${key}: ${widgetLines.join(" · ")}`);
    }
  }

  if (model.windowTitle) {
    lines.push(model.windowTitle);
  }

  return lines;
}

export function latestNotification(model: SessionReadModel) {
  return model.notifications[0] ?? null;
}

function createLiveToolMessage(tool: ToolActivity) {
  return {
    role: "toolExecution",
    toolCallId: tool.toolCallId,
    toolName: tool.toolName,
    args: tool.args,
    content: tool.content,
    isError: tool.isError,
    state: tool.state,
    __live: true,
  };
}
