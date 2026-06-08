import type {
  AbortTurnCommand,
  ResolveApprovalCommand,
  ResolveUserInputCommand,
  SendTurnCommand,
} from "./commands.js";
import type { ProviderCapabilities } from "./capabilities.js";
import type { ProviderId, ProviderSessionRef, RepoPath, SessionId, TurnId } from "./ids.js";
import type { RuntimeBinding } from "./runtime-binding.js";
import type { RuntimeEvent } from "./runtime-events.js";

export type ProviderDescriptor = {
  id: ProviderId;
  name: string;
  version?: string;
  capabilities: ProviderCapabilities;
  metadata?: Record<string, unknown>;
};

export type ProviderRuntime = {
  binding: RuntimeBinding;
  stop(): Promise<void>;
};

export type RuntimeEventSink = (event: RuntimeEvent) => void | Promise<void>;

export type ProviderAdapter = {
  descriptor: ProviderDescriptor;
  startSession(request: StartProviderSessionRequest, events: RuntimeEventSink): Promise<ProviderRuntime>;
  resumeSession(request: ResumeProviderSessionRequest, events: RuntimeEventSink): Promise<ProviderRuntime>;
  sendTurn(binding: RuntimeBinding, command: SendTurnCommand): Promise<TurnStartedResult | void>;
  abortTurn(binding: RuntimeBinding, command: AbortTurnCommand): Promise<void>;
  resolveApproval?(binding: RuntimeBinding, command: ResolveApprovalCommand): Promise<void>;
  resolveUserInput?(binding: RuntimeBinding, command: ResolveUserInputCommand): Promise<void>;
};

export type StartProviderSessionRequest = {
  sessionId: SessionId;
  providerId: ProviderId;
  repoPath: RepoPath;
  options?: unknown;
};

export type ResumeProviderSessionRequest = {
  sessionId: SessionId;
  providerId: ProviderId;
  repoPath: RepoPath;
  providerSessionRef?: ProviderSessionRef;
  resumeCursor?: unknown;
  options?: unknown;
};

export type TurnStartedResult = {
  turnId?: TurnId;
};
