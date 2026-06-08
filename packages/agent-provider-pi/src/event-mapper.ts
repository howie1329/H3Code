import type { ProviderId, RuntimeEvent, RuntimeItemId, SessionId, TurnId } from "@h3code/agent-protocol";
import type { PiProviderEvent } from "./pi-sdk/types.js";

export type PiRuntimeEventMapperState = {
  turnId?: TurnId;
  assistantItemId?: RuntimeItemId;
  nextTurnIndex: number;
};

export type PiRuntimeEventMapperContext = {
  sessionId: SessionId;
  providerId?: ProviderId;
  state?: PiRuntimeEventMapperState;
};

const defaultProviderId = "pi";

export function createPiRuntimeEventMapperState(): PiRuntimeEventMapperState {
  return { nextTurnIndex: 0 };
}

export function mapPiEventToRuntimeEvents(event: PiProviderEvent, context: PiRuntimeEventMapperContext): RuntimeEvent[] {
  const state = context.state ?? createPiRuntimeEventMapperState();
  const providerId = context.providerId ?? defaultProviderId;
  const base = { sessionId: context.sessionId, providerId, occurredAt: event.occurredAt };

  switch (event.type) {
    case "session.changed":
      return [
        {
          ...base,
          type: "session.updated",
          status: event.snapshot.isStreaming || event.snapshot.isCompacting ? "running" : "idle",
          providerSessionRef: event.snapshot.sessionFile ?? event.snapshot.sessionId,
          title: event.snapshot.sessionName,
          model: modelId(event.snapshot.model),
          metadata: {
            cwd: event.snapshot.cwd,
            diagnostics: event.snapshot.diagnostics,
            modelFallbackMessage: event.snapshot.modelFallbackMessage,
          },
        },
      ];

    case "run.started":
      return [{ ...base, type: "turn.started", turnId: ensureTurn(state, context.sessionId) }];
    case "turn.started": {
      if (state.turnId) return [];
      const turnId = ensureTurn(state, context.sessionId);
      return [{ ...base, type: "turn.started", turnId }];
    }

    case "message.streaming":
      return mapMessageStreaming(event, base, state, context.sessionId);

    case "tool.updated": {
      const turnId = ensureTurn(state, context.sessionId);
      const itemId = `tool-${event.toolCallId}`;
      const status = event.phase === "start" ? "running" : event.phase === "end" ? (event.isError ? "failed" : "completed") : "running";
      return [
        {
          ...base,
          type: "tool.updated",
          turnId,
          itemId,
          toolName: event.toolName,
          status,
          input: event.args,
          output: event.content,
          errorText: event.errorText,
        },
      ];
    }

    case "turn.completed":
    case "run.ended": {
      const turnId = ensureTurn(state, context.sessionId);
      state.turnId = undefined;
      state.assistantItemId = undefined;
      return [{ ...base, type: "turn.completed", turnId, status: "completed", usage: event.type === "run.ended" ? event.messages : undefined }];
    }

    case "run.failed": {
      const turnId = state.turnId;
      const events: RuntimeEvent[] = [{ ...base, type: "runtime.error", turnId, message: event.errorMessage, recoverable: true }];
      if (turnId) events.push({ ...base, type: "turn.completed", turnId, status: "failed" });
      state.turnId = undefined;
      state.assistantItemId = undefined;
      return events;
    }

    case "extension.ui.request":
      return [
        {
          ...base,
          type: event.request.kind === "confirm" ? "approval.requested" : "user_input.requested",
          requestId: event.request.id,
          turnId: state.turnId,
          payload: event.request,
        } as RuntimeEvent,
      ];

    case "extension.error":
      return [{ ...base, type: "runtime.error", turnId: state.turnId, message: event.message, cause: event, recoverable: true }];

    case "provider.diagnostic":
      if (event.level === "error") {
        return [{ ...base, type: "runtime.error", turnId: state.turnId, message: event.message, cause: event.detail, recoverable: true }];
      }
      return [];

    default:
      return [];
  }
}

function mapMessageStreaming(
  event: Extract<PiProviderEvent, { type: "message.streaming" }>,
  base: Pick<RuntimeEvent, "sessionId" | "providerId" | "occurredAt">,
  state: PiRuntimeEventMapperState,
  sessionId: SessionId,
): RuntimeEvent[] {
  const turnId = ensureTurn(state, sessionId);
  const itemId = state.assistantItemId ?? `${turnId}-assistant`;
  state.assistantItemId = itemId;

  if (event.phase === "start") {
    return [{ ...base, type: "item.started", turnId, itemId, itemType: "assistant_message" }];
  }

  if (event.phase === "end") return [];

  if (event.errorMessage) {
    return [{ ...base, type: "runtime.error", turnId, itemId, message: event.errorMessage, recoverable: true }];
  }

  const delta = textFromUnknown(event.message);
  return delta ? [{ ...base, type: "content.delta", turnId, itemId, stream: "assistant_text", delta }] : [];
}

function ensureTurn(state: PiRuntimeEventMapperState, sessionId: SessionId): TurnId {
  if (!state.turnId) {
    state.nextTurnIndex += 1;
    state.turnId = `${sessionId}-turn-${state.nextTurnIndex}`;
  }
  return state.turnId;
}

function textFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "content", "delta"]) {
      if (typeof record[key] === "string") return record[key];
    }
  }
  return value === undefined ? undefined : String(value);
}

function modelId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.id === "string") return record.id;
    if (typeof record.name === "string") return record.name;
  }
  return undefined;
}
