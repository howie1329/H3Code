import type {
  ProviderCommand,
  ProviderModel,
  ProviderQueueMode,
  WorkspaceDiffSummary,
} from "@h3code/agent-protocol";

export type SessionNotification = {
  id: string;
  message: string;
  notifyType: "info" | "warning" | "error";
};

export type SessionDiffState = WorkspaceDiffSummary & {
  patch?: string;
};

export type { ProviderCommand, ProviderModel, ProviderQueueMode };
