import type {
  ActivityId,
  MessageId,
  RuntimeEvent,
  RuntimeSnapshotMessage,
  RuntimeItemType,
  SessionReadModel,
  SessionReadModelPatch,
  UiActivity,
  UiMessage,
  UiSessionEvent,
} from "@h3code/agent-protocol";
import { runtimeErrors } from "./errors.js";

type ProjectionResult = { session: SessionReadModel; events: UiSessionEvent[] };

export class ReadModelProjector {
  apply(current: SessionReadModel | undefined, event: RuntimeEvent): ProjectionResult {
    if (!current && event.type !== "session.started") {
      throw runtimeErrors.invalidRuntimeEvent(event.type, event.sessionId);
    }

    const session = current ? cloneSession(current) : createEmptySession(event);
    session.updatedAt = event.occurredAt;

    switch (event.type) {
      case "session.started": {
        if (event.repoPath) session.repoPath = event.repoPath;
        session.providerSessionRef = event.providerSessionRef ?? session.providerSessionRef;
        if (event.modelState) session.model = { ...event.modelState, providerId: event.providerId };
        else if (event.model) session.model = { id: event.model, name: event.model, providerId: event.providerId };
        if (event.thinkingLevel !== undefined) session.thinkingLevel = event.thinkingLevel;
        if (event.queueSettings !== undefined) session.queueSettings = event.queueSettings;
        if (event.autoCompactionEnabled !== undefined) session.autoCompactionEnabled = event.autoCompactionEnabled;
        session.status = "idle";
        return { session, events: [{ type: "session.snapshot", session }] };
      }
      case "session.updated": {
        if (event.status) session.status = event.status === "error" ? "error" : event.status === "running" ? "running" : "idle";
        if (event.status && event.status !== "running") {
          const finalStatus = event.status === "error" ? "failed" : "completed";
          session.activeTurnId = undefined;
          session.messages = session.messages.map((message) =>
            message.status === "streaming" ? { ...message, status: finalStatus, updatedAt: event.occurredAt } : message,
          );
          session.activities = session.activities.map((activity) =>
            activity.status === "running" || activity.status === "pending"
              ? { ...activity, status: finalStatus, updatedAt: event.occurredAt }
              : activity,
          );
        }
        session.providerSessionRef = event.providerSessionRef ?? session.providerSessionRef;
        if (event.title !== undefined) session.title = event.title;
        if (event.modelState) session.model = { ...event.modelState, providerId: event.providerId };
        else if (event.model) session.model = { id: event.model, name: event.model, providerId: event.providerId };
        if (event.thinkingLevel !== undefined) session.thinkingLevel = event.thinkingLevel;
        if (event.queueSettings !== undefined) session.queueSettings = event.queueSettings;
        if (event.autoCompactionEnabled !== undefined) session.autoCompactionEnabled = event.autoCompactionEnabled;
        if (event.messages !== undefined) {
          session.messages = event.messages.map((message) => snapshotMessageToUiMessage(message, event.sessionId, event.occurredAt));
        }
        return patch(session, { status: session.status, activeTurnId: session.activeTurnId ?? null, title: session.title ?? null, messages: session.messages, activities: session.activities, model: session.model ?? null, thinkingLevel: session.thinkingLevel ?? null, queueSettings: session.queueSettings ?? null, autoCompactionEnabled: session.autoCompactionEnabled ?? null, updatedAt: event.occurredAt });
      }
      case "session.ended": {
        session.status = event.status === "failed" ? "error" : "idle";
        session.activeTurnId = undefined;
        completeActiveItems(session, event.status === "failed" ? "failed" : "completed", event.occurredAt);
        return patch(session, { status: session.status, activeTurnId: null, messages: session.messages, activities: session.activities, updatedAt: event.occurredAt });
      }
      case "turn.started": {
        session.status = "running";
        session.activeTurnId = event.turnId;
        if (event.model) session.model = { id: event.model, name: event.model, providerId: event.providerId };
        return patch(session, { status: "running", activeTurnId: event.turnId, model: session.model ?? null, updatedAt: event.occurredAt });
      }
      case "turn.completed": {
        session.status = event.status === "failed" ? "error" : "idle";
        session.activeTurnId = undefined;
        session.tokenUsage = normalizeUsage(event.usage) ?? session.tokenUsage;
        completeActiveItems(session, event.status === "failed" ? "failed" : "completed", event.occurredAt);
        return patch(session, { status: session.status, activeTurnId: null, messages: session.messages, activities: session.activities, tokenUsage: session.tokenUsage ?? null, updatedAt: event.occurredAt });
      }
      case "item.started": {
        if (event.itemType === "assistant_message") {
          const message = upsertMessage(session, messageId(event.sessionId, event.itemId), { sessionId: event.sessionId, turnId: event.turnId, role: "assistant", content: "", status: "streaming", createdAt: event.occurredAt, updatedAt: event.occurredAt });
          return { session, events: [{ type: "thread.message.upserted", sessionId: event.sessionId, message }] };
        }
        const activity = upsertActivity(session, activityId(event.sessionId, event.itemId), { sessionId: event.sessionId, turnId: event.turnId, itemId: event.itemId, kind: activityKind(event.itemType), title: event.title, status: "running", createdAt: event.occurredAt, updatedAt: event.occurredAt });
        return { session, events: [{ type: "thread.activity.upserted", sessionId: event.sessionId, activity }] };
      }
      case "content.delta": {
        const existingMessage = session.messages.find((m) => m.id === messageId(event.sessionId, event.itemId));
        if (event.stream === "assistant_text" || existingMessage) {
          const message = upsertMessage(session, messageId(event.sessionId, event.itemId), { sessionId: event.sessionId, turnId: event.turnId, role: "assistant", content: `${existingMessage?.content ?? ""}${event.delta}`, status: "streaming", createdAt: existingMessage?.createdAt ?? event.occurredAt, updatedAt: event.occurredAt });
          return { session, events: [{ type: "thread.message.upserted", sessionId: event.sessionId, message }] };
        }
        const existingActivity = session.activities.find((a) => a.id === activityId(event.sessionId, event.itemId));
        const activity = upsertActivity(session, activityId(event.sessionId, event.itemId), { sessionId: event.sessionId, turnId: event.turnId, itemId: event.itemId, kind: event.stream === "reasoning_text" ? "reasoning" : "tool", content: `${existingActivity?.content ?? ""}${event.delta}`, status: "running", createdAt: existingActivity?.createdAt ?? event.occurredAt, updatedAt: event.occurredAt });
        return { session, events: [{ type: "thread.activity.upserted", sessionId: event.sessionId, activity }] };
      }
      case "tool.updated": {
        const existing = session.activities.find((a) => a.id === activityId(event.sessionId, event.itemId));
        const activity = upsertActivity(session, activityId(event.sessionId, event.itemId), { sessionId: event.sessionId, turnId: event.turnId, itemId: event.itemId, kind: "tool", title: event.toolName, status: event.status, input: event.input, output: event.output, errorText: event.errorText, createdAt: existing?.createdAt ?? event.occurredAt, updatedAt: event.occurredAt });
        return { session, events: [{ type: "thread.activity.upserted", sessionId: event.sessionId, activity }] };
      }
      case "approval.requested":
      case "user_input.requested": {
        const request = { id: event.requestId, sessionId: event.sessionId, turnId: event.turnId, itemId: event.itemId, kind: event.type === "approval.requested" ? "approval" as const : "user_input" as const, payload: event.payload, createdAt: event.occurredAt };
        session.pendingInteractions = [...session.pendingInteractions.filter((i) => i.id !== request.id), request];
        return { session, events: [{ type: "interaction.requested", sessionId: event.sessionId, request }] };
      }
      case "runtime.error": {
        const activity = upsertActivity(session, activityId(event.sessionId, event.itemId ?? `error:${event.occurredAt}`), { sessionId: event.sessionId, turnId: event.turnId, itemId: event.itemId, kind: "error", title: event.code, content: event.message, status: "failed", errorText: event.message, createdAt: event.occurredAt, updatedAt: event.occurredAt });
        if (!event.recoverable) session.status = "error";
        return { session, events: [{ type: "thread.activity.upserted", sessionId: event.sessionId, activity }, { type: "session.patch", sessionId: event.sessionId, patch: { status: session.status, updatedAt: event.occurredAt } }] };
      }
    }
  }
}

function createEmptySession(event: RuntimeEvent): SessionReadModel {
  return { id: event.sessionId, providerId: event.providerId, repoPath: "", status: "idle", messages: [], activities: [], pendingInteractions: [], updatedAt: event.occurredAt };
}
function cloneSession(s: SessionReadModel): SessionReadModel { return { ...s, messages: [...s.messages], activities: [...s.activities], pendingInteractions: [...s.pendingInteractions] }; }
function patch(session: SessionReadModel, patchValue: SessionReadModelPatch): ProjectionResult { return { session, events: [{ type: "session.patch", sessionId: session.id, patch: patchValue }] }; }
function messageId(sessionId: string, itemId: string): MessageId { return `msg:${sessionId}:${itemId}`; }
function activityId(sessionId: string, itemId: string): ActivityId { return `act:${sessionId}:${itemId}`; }
function activityKind(type: RuntimeItemType): UiActivity["kind"] { return type === "command_execution" ? "command" : type === "dynamic_tool_call" ? "tool" : type === "assistant_message" ? "reasoning" : type; }
function upsertMessage(session: SessionReadModel, id: MessageId, message: Omit<UiMessage, "id">): UiMessage { const next = { id, ...message }; session.messages = [...session.messages.filter((m) => m.id !== id), next]; return next; }
function upsertActivity(session: SessionReadModel, id: ActivityId, activity: Omit<UiActivity, "id">): UiActivity { const next = { id, ...activity }; session.activities = [...session.activities.filter((a) => a.id !== id), next]; return next; }
function normalizeUsage(usage: unknown): SessionReadModel["tokenUsage"] | undefined { return usage && typeof usage === "object" ? usage as SessionReadModel["tokenUsage"] : undefined; }
function snapshotMessageToUiMessage(message: RuntimeSnapshotMessage, sessionId: string, occurredAt: number): UiMessage {
  const createdAt = message.createdAt ?? occurredAt;
  return {
    id: `msg:${sessionId}:${message.id}`,
    sessionId,
    role: message.role,
    content: message.content,
    status: "completed",
    createdAt,
    updatedAt: message.updatedAt ?? createdAt,
    metadata: message.metadata,
  };
}
function completeActiveItems(session: SessionReadModel, status: "completed" | "failed", updatedAt: number): void {
  session.messages = session.messages.map((message) =>
    message.status === "streaming" ? { ...message, status, updatedAt } : message,
  );
  session.activities = session.activities.map((activity) =>
    activity.status === "running" || activity.status === "pending" ? { ...activity, status, updatedAt } : activity,
  );
}
