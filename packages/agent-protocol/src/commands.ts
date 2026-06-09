import type { ProviderCommand, ProviderModel, ProviderQueueMode } from "./providers.js";
import type { ProviderId, ProviderSessionRef, RepoPath, RequestId, SessionId, TurnId } from "./ids.js";

export type AgentCommand =
  | CreateSessionCommand
  | SwitchSessionCommand
  | DeleteSessionCommand
  | ResumeSessionCommand
  | SendTurnCommand
  | AbortTurnCommand
  | ListProviderCommandsCommand
  | DiscoverProviderModelsCommand
  | ListProviderModelsCommand
  | SetProviderModelCommand
  | SetProviderThinkingCommand
  | SetProviderQueueCommand
  | SetProviderCompactionCommand
  | ResolveApprovalCommand
  | ResolveUserInputCommand;

export type CreateSessionCommand = {
  type: "session.create";
  repoPath: RepoPath;
  providerId: ProviderId;
  options?: unknown;
};

export type ResumeSessionCommand = {
  type: "session.resume";
  sessionId: SessionId;
  providerSessionRef?: ProviderSessionRef;
  resumeCursor?: unknown;
};

export type SwitchSessionCommand = {
  type: "session.switch";
  sessionId: SessionId;
  repoPath: RepoPath;
  providerId: ProviderId;
};

export type DeleteSessionCommand = {
  type: "session.delete";
  sessionId: SessionId;
  repoPath: RepoPath;
  providerId?: ProviderId;
};

export type SendTurnCommand = {
  type: "turn.send";
  sessionId: SessionId;
  input: TurnInput;
};

export type TurnInput = {
  text?: string;
  attachments?: ChatAttachment[];
  mode?: "default" | "plan";
  metadata?: Record<string, unknown>;
};

export type ChatAttachment = {
  id?: string;
  name: string;
  mimeType?: string;
  content?: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

export type AbortTurnCommand = {
  type: "turn.abort";
  sessionId: SessionId;
  turnId?: TurnId;
};

export type ListProviderCommandsCommand = {
  type: "provider.commands.list";
  sessionId: SessionId;
};

export type ListProviderModelsCommand = {
  type: "provider.models.list";
  sessionId: SessionId;
};

export type DiscoverProviderModelsCommand = {
  type: "provider.models.discover";
  providerId: ProviderId;
  repoPath?: RepoPath;
  options?: unknown;
};

export type SetProviderModelCommand = {
  type: "provider.model.set";
  sessionId: SessionId;
  model: ProviderModel;
};

export type SetProviderThinkingCommand = {
  type: "provider.thinking.set";
  sessionId: SessionId;
  level: string;
};

export type SetProviderQueueCommand = {
  type: "provider.queue.set";
  sessionId: SessionId;
  steeringMode?: ProviderQueueMode;
  followUpMode?: ProviderQueueMode;
};

export type SetProviderCompactionCommand = {
  type: "provider.compaction.set";
  sessionId: SessionId;
  enabled: boolean;
};

export type ResolveApprovalCommand = {
  type: "approval.resolve";
  sessionId: SessionId;
  requestId: RequestId;
  approved: boolean;
  response?: unknown;
};

export type ResolveUserInputCommand = {
  type: "user_input.resolve";
  sessionId: SessionId;
  requestId: RequestId;
  input: unknown;
};

export type ProviderCommandListResult = {
  commands: ProviderCommand[];
};

export type ProviderModelListResult = {
  models: ProviderModel[];
};
