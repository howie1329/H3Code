import type {
  AbortTurnCommand,
  DiscoverProviderModelsCommand,
  ListProviderCommandsCommand,
  ListProviderModelsCommand,
  ResolveApprovalCommand,
  ResolveUserInputCommand,
  SendTurnCommand,
  SetProviderCompactionCommand,
  SetProviderModelCommand,
  SetProviderQueueCommand,
  SetProviderThinkingCommand,
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

export type ProviderCommandSource = "extension" | "prompt" | "skill";

export type ProviderCommand = {
  name: string;
  description?: string;
  source: ProviderCommandSource;
  location?: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderModel = {
  id: string;
  provider?: string;
  name?: string;
  modelId?: string;
  reasoning?: boolean;
  metadata?: Record<string, unknown>;
};

export type ProviderQueueMode = "all" | "one-at-a-time";

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
  listCommands?(binding: RuntimeBinding, command: ListProviderCommandsCommand): Promise<ProviderCommand[]>;
  discoverModels?(command: DiscoverProviderModelsCommand): Promise<ProviderModel[]>;
  listModels?(binding: RuntimeBinding, command: ListProviderModelsCommand): Promise<ProviderModel[]>;
  setModel?(binding: RuntimeBinding, command: SetProviderModelCommand): Promise<void>;
  setThinkingLevel?(binding: RuntimeBinding, command: SetProviderThinkingCommand): Promise<void>;
  setQueueSettings?(binding: RuntimeBinding, command: SetProviderQueueCommand): Promise<void>;
  setAutoCompaction?(binding: RuntimeBinding, command: SetProviderCompactionCommand): Promise<void>;
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
