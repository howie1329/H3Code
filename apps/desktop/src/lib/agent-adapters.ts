import type {
  ConnectionId,
  ConnectionState,
  ProviderCommand,
  ProviderModel,
  ProviderUiRequest,
  ProviderUiResponse,
  SessionSnapshot,
  SessionSummary,
  WorkspaceDiffSummary,
} from "@h3code/agent-core";

import { normalizeModel, normalizeThinkingLevel } from "./pi-model.js";

export function sessionSummaryToPiSessionSummary(summary: SessionSummary): PiSessionSummary {
  const createdAt = summary.createdAt ? new Date(summary.createdAt).toISOString() : "";
  const updatedAt = summary.updatedAt ? new Date(summary.updatedAt).toISOString() : "";

  return {
    path: summary.sessionRef,
    id: sessionRefToId(summary.sessionRef),
    cwd: summary.repoPath ?? "",
    agentId: summary.liveConnectionId,
    worktreePath: summary.worktreePath ?? summary.repoPath,
    name: summary.title,
    created: createdAt,
    modified: updatedAt,
    messageCount: summary.messageCount ?? 0,
    firstMessage: summary.preview ?? "",
  };
}

export function snapshotToPiSessionState(snapshot: SessionSnapshot): PiSessionState {
  const model = snapshot.model ? normalizeModel(snapshot.model) : undefined;

  return {
    model,
    thinkingLevel: normalizeThinkingLevel(snapshot.thinkingLevel),
    isStreaming: snapshot.isStreaming,
    isCompacting: snapshot.isCompacting,
    steeringMode: snapshot.steeringMode ?? "one-at-a-time",
    followUpMode: snapshot.followUpMode ?? "one-at-a-time",
    sessionFile: snapshot.summary.sessionRef,
    sessionId: sessionRefToId(snapshot.summary.sessionRef),
    sessionName: snapshot.summary.title,
    autoCompactionEnabled: snapshot.autoCompactionEnabled ?? true,
    messageCount: snapshot.messages.length,
    pendingMessageCount: snapshot.steering.length + snapshot.followUp.length,
  };
}

export function snapshotToPiSessionStats(snapshot: SessionSnapshot): PiSessionStats | null {
  const stats = snapshot.stats;

  if (!stats || typeof stats !== "object") {
    return null;
  }

  const record = stats as Record<string, unknown>;
  const tokens = toRecord(record.tokens);
  const contextUsage = toRecord(record.contextUsage);

  return {
    sessionFile: snapshot.summary.sessionRef,
    sessionId: sessionRefToId(snapshot.summary.sessionRef),
    userMessages: numberOrZero(record.userMessages),
    assistantMessages: numberOrZero(record.assistantMessages),
    toolCalls: numberOrZero(record.toolCalls),
    toolResults: numberOrZero(record.toolResults),
    totalMessages: numberOrZero(record.totalMessages),
    tokens: {
      input: numberOrZero(tokens.input),
      output: numberOrZero(tokens.output),
      cacheRead: numberOrZero(tokens.cacheRead),
      cacheWrite: numberOrZero(tokens.cacheWrite),
      total: numberOrZero(tokens.total),
    },
    cost: typeof record.cost === "number" ? record.cost : 0,
    contextUsage: contextUsage
      ? {
          tokens: typeof contextUsage.tokens === "number" ? contextUsage.tokens : null,
          contextWindow: numberOrZero(contextUsage.contextWindow),
          percent: typeof contextUsage.percent === "number" ? contextUsage.percent : null,
        }
      : undefined,
  };
}

export function connectionStatusToPiStatus(
  state: ConnectionState,
  connectionId: ConnectionId,
  repoPath?: string,
  message?: string,
): PiStatus {
  const piState: PiConnectionState =
    state === "connected"
      ? "connected"
      : state === "starting"
        ? "starting"
        : state === "error"
          ? "error"
          : state === "exited"
            ? "exited"
            : "disconnected";

  return {
    state: piState,
    agentId: connectionId,
    repoPath,
    worktreePath: repoPath,
    diagnostic: message,
  };
}

export function providerUiToPiRequest(connectionId: ConnectionId, request: ProviderUiRequest): PiExtensionUiRequest {
  const base = {
    type: "extension_ui_request" as const,
    id: request.id,
    agentId: connectionId,
  };

  switch (request.kind) {
    case "select":
      return {
        ...base,
        method: "select",
        title: request.title,
        options: request.options,
      };
    case "confirm":
      return {
        ...base,
        method: "confirm",
        title: request.title,
        message: request.message ?? "",
      };
    case "input":
      return {
        ...base,
        method: "input",
        title: request.title,
        placeholder: request.placeholder,
      };
    case "editor":
      return {
        ...base,
        method: "editor",
        title: request.title,
        prefill: request.value,
      };
    case "custom":
      return {
        ...base,
        method: "custom",
        componentId: request.componentId,
        payload: request.payload,
        overlay: request.overlay,
      };
  }
}

export function piExtensionUiResponseToProvider(response: PiExtensionUiResponse): ProviderUiResponse {
  if (response.method === "custom") {
    if ("cancelled" in response && response.cancelled) {
      return { requestId: response.id, kind: "custom", canceled: true };
    }

    return {
      requestId: response.id,
      kind: "custom",
      value: "value" in response ? response.value : undefined,
    };
  }

  if ("cancelled" in response && response.cancelled) {
    return response.method === "select"
      ? { requestId: response.id, kind: "select", canceled: true }
      : response.method === "input" || response.method === "editor"
        ? { requestId: response.id, kind: response.method, canceled: true }
        : { requestId: response.id, kind: "confirm", accepted: false, canceled: true };
  }

  if ("confirmed" in response) {
    return { requestId: response.id, kind: "confirm", accepted: response.confirmed };
  }

  if ("value" in response) {
    return {
      requestId: response.id,
      kind: response.method === "select" || response.method === "editor" ? response.method : "input",
      value: response.value,
    };
  }

  return { requestId: response.id, kind: "confirm", accepted: false, canceled: true };
}

export function wrapSessionEvent(
  connectionId: ConnectionId,
  event: import("@h3code/agent-core").SessionDomainEvent,
): import("$lib/pi-session/domain-events.js").SessionDomainEvent & { agentId: string } {
  return { ...(event as import("$lib/pi-session/domain-events.js").SessionDomainEvent), agentId: connectionId };
}

function sessionRefToId(sessionRef: string): string {
  const base = sessionRef.split("/").pop() ?? sessionRef;
  return base.replace(/\.jsonl?$/i, "");
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function providerCommandToPiSlashCommand(command: ProviderCommand): PiSlashCommand {
  return {
    name: command.name,
    description: command.description,
    source: command.source,
    location: command.location,
    path: command.path,
    sourceInfo: command.sourceInfo,
  };
}

export function providerModelToPiModel(model: ProviderModel): PiModel {
  return {
    provider: model.provider,
    id: model.modelId ?? model.id,
    name: model.name,
    reasoning: model.reasoning,
  };
}

export function workspaceDiffToPiSessionDiff(diff: WorkspaceDiffSummary): PiSessionDiff {
  return {
    patch: diff.patch ?? "",
    changedFiles: diff.changedFiles ?? diff.files.length,
  };
}
