import type { ProviderModel } from "$lib/provider-model.js";

export type ProviderCommandSource = "extension" | "prompt" | "skill";

export type ProviderCommand = {
  name: string;
  description?: string;
  source: ProviderCommandSource;
  location?: string;
  path?: string;
};

export type ProviderQueueMode = "all" | "one-at-a-time";

export type SessionNotification = {
  id: string;
  message: string;
  notifyType: "info" | "warning" | "error";
};

export type SessionDiffState = {
  changedFiles: number;
  additions?: number;
  deletions?: number;
  files?: Array<{
    path: string;
    status: "added" | "modified" | "deleted" | "renamed" | "untracked";
    additions?: number;
    deletions?: number;
  }>;
  patch?: string;
};

export type { ProviderModel };
