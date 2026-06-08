import type { AgentCommand } from "./commands.js";
import type { RequestId, SessionId } from "./ids.js";
import type { SessionReadModel } from "./session-read-model.js";
import type { UiSessionEvent } from "./ui-events.js";

export const AGENT_PROTOCOL_VERSION = 1;

export type AgentProtocolVersion = typeof AGENT_PROTOCOL_VERSION;

export type ProtocolEnvelope<TType extends string, TPayload = unknown> = {
  id?: RequestId;
  type: TType;
  protocolVersion: AgentProtocolVersion;
  payload: TPayload;
  sentAt?: number;
};

export type ClientToServerMessage =
  | ProtocolEnvelope<"command", AgentCommand>
  | ProtocolEnvelope<"session.subscribe", { sessionId: SessionId }>
  | ProtocolEnvelope<"session.unsubscribe", { sessionId: SessionId }>
  | ProtocolEnvelope<"session.snapshot.request", { sessionId: SessionId }>;

export type ServerToClientMessage =
  | ProtocolEnvelope<"session.event", UiSessionEvent>
  | ProtocolEnvelope<"session.snapshot.response", { session: SessionReadModel }>
  | ProtocolEnvelope<"error", ProtocolError>;

export type ProtocolError = {
  code: string;
  message: string;
  requestId?: RequestId;
  details?: unknown;
};
