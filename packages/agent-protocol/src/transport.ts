import type { AgentCommand, ProviderCommandListResult, ProviderModelListResult } from "./commands.js";
import type { RequestId, SessionId } from "./ids.js";
import type { SessionReadModel } from "./session-read-model.js";
import type { UiSessionEvent } from "./ui-events.js";
import type { ListSessionsInput, SessionSummary } from "./workspace.js";

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
  | ProtocolEnvelope<"session.snapshot.request", { sessionId: SessionId }>
  | ProtocolEnvelope<"session.list.request", ListSessionsInput>;

export type ServerToClientMessage =
  | ProtocolEnvelope<"command.result", CommandResult>
  | ProtocolEnvelope<"session.event", UiSessionEvent>
  | ProtocolEnvelope<"session.snapshot.response", { requestId?: RequestId; session: SessionReadModel }>
  | ProtocolEnvelope<"session.list.response", { requestId?: RequestId; sessions: SessionSummary[] }>
  | ProtocolEnvelope<"error", ProtocolError>;

export type CommandResult = {
  requestId?: RequestId;
  session?: SessionReadModel;
  providerCommands?: ProviderCommandListResult;
  providerModels?: ProviderModelListResult;
  sessions?: SessionSummary[];
};

export type ProtocolError = {
  code: string;
  message: string;
  requestId?: RequestId;
  details?: unknown;
};
