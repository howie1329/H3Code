import type { RequestId, SessionId } from "./ids.js";
import type {
  PendingInteraction,
  SessionReadModel,
  SessionReadModelPatch,
  UiActivity,
  UiMessage,
} from "./session-read-model.js";

export type UiSessionEvent =
  | SessionSnapshotEvent
  | SessionPatchEvent
  | ThreadMessageUpsertedEvent
  | ThreadActivityUpsertedEvent
  | InteractionRequestedEvent
  | InteractionResolvedEvent;

export type SessionSnapshotEvent = {
  type: "session.snapshot";
  session: SessionReadModel;
};

export type SessionPatchEvent = {
  type: "session.patch";
  sessionId: SessionId;
  patch: SessionReadModelPatch;
};

export type ThreadMessageUpsertedEvent = {
  type: "thread.message.upserted";
  sessionId: SessionId;
  message: UiMessage;
};

export type ThreadActivityUpsertedEvent = {
  type: "thread.activity.upserted";
  sessionId: SessionId;
  activity: UiActivity;
};

export type InteractionRequestedEvent = {
  type: "interaction.requested";
  sessionId: SessionId;
  request: PendingInteraction;
};

export type InteractionResolvedEvent = {
  type: "interaction.resolved";
  sessionId: SessionId;
  requestId: RequestId;
};
