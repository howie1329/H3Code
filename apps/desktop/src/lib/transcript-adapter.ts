import type { SessionReadModel, UiActivity, UiMessage } from "@h3code/agent-protocol";

import type { ComposerPhaseLine } from "$lib/transcript-selectors.js";

export function committedTranscriptMessages(model: SessionReadModel): unknown[] {
  return model.messages.map(messageToTranscriptShape);
}

export function liveTranscriptMessages(model: SessionReadModel): unknown[] {
  const extras: unknown[] = [];

  for (const activity of model.activities) {
    if (activity.status === "running" || activity.status === "pending") {
      extras.push(activityToTranscriptShape(activity));
    }
  }

  return extras;
}

export function transcriptMessages(model: SessionReadModel): unknown[] {
  return [...committedTranscriptMessages(model), ...liveTranscriptMessages(model)];
}

export function composerPhase(model: SessionReadModel): ComposerPhaseLine | null {
  if (model.status === "error") {
    return { tone: "error", text: "Session error" };
  }

  const activeActivity = model.activities.find(
    (activity) => activity.status === "running" || activity.status === "pending",
  );

  if (activeActivity) {
    if (activeActivity.kind === "reasoning") {
      return { tone: "working", text: "Thinking…" };
    }

    const label = activeActivity.title ?? activeActivity.kind;
    return { tone: "working", text: `Running ${label}…` };
  }

  const streamingMessage = model.messages.find((message) => message.status === "streaming");

  if (streamingMessage) {
    return { tone: "working", text: "Writing response…" };
  }

  if (model.status === "running") {
    return { tone: "working", text: "Pi is working…" };
  }

  return null;
}

export function statusStripLines(model: SessionReadModel): string[] {
  const phase = composerPhase(model);
  return phase ? [phase.text] : [];
}

export function isAgentRunning(model: SessionReadModel): boolean {
  return (
    model.status === "running" ||
    model.messages.some((message) => message.status === "streaming") ||
    model.activities.some((activity) => activity.status === "running" || activity.status === "pending")
  );
}

export function streamingMessage(model: SessionReadModel): unknown | null {
  const streaming = model.messages.find((message) => message.status === "streaming");
  return streaming ? messageToTranscriptShape(streaming) : null;
}

function messageToTranscriptShape(message: UiMessage): unknown {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    metadata: message.metadata,
  };
}

function activityToTranscriptShape(activity: UiActivity): unknown {
  if (activity.kind === "reasoning") {
    return {
      role: "assistant",
      content: [{ type: "thinking", thinking: activity.content ?? "" }],
      __live: true,
    };
  }

  if (activity.kind === "tool" || activity.kind === "command") {
    return {
      role: "toolExecution",
      toolCallId: activity.itemId ?? activity.id,
      toolName: activity.title ?? activity.kind,
      args: activity.input,
      content: activity.output,
      isError: activity.status === "failed",
      state: mapActivityState(activity.status),
      __live: true,
    };
  }

  return {
    role: "assistant",
    content: activity.content ?? activity.title ?? "",
    __live: true,
  };
}

function mapActivityState(status: UiActivity["status"]): string {
  switch (status) {
    case "pending":
      return "input-streaming";
    case "running":
      return "input-available";
    case "failed":
      return "output-error";
    case "completed":
    default:
      return "output-available";
  }
}
