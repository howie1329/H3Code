import type { ProviderId, ProviderSessionRef, RepoPath, RequestId, SessionId, TurnId } from "./ids.js";

export type AgentCommand =
  | CreateSessionCommand
  | ResumeSessionCommand
  | SendTurnCommand
  | AbortTurnCommand
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
