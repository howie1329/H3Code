import type { ProviderId, ProviderSessionRef, RepoPath, SessionId, TurnId } from "./ids.js";

export type RuntimeBindingStatus = "starting" | "running" | "stopped" | "error";

export type RuntimeBinding = {
  sessionId: SessionId;
  providerId: ProviderId;
  repoPath: RepoPath;
  providerSessionRef?: ProviderSessionRef;
  resumeCursor?: unknown;
  providerOptions?: unknown;
  status: RuntimeBindingStatus;
  activeTurnId?: TurnId;
  lastEvent?: string;
  lastEventAt?: number;
};

export type CloudRuntimeBinding = RuntimeBinding & {
  workspaceRepositoryId: string;
  sandboxId: string;
  workBranch: string;
};
