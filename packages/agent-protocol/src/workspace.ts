import type { ProviderId } from "./ids.js";

/**
 * App-level summary of a workspace session for list surfaces (e.g. the desktop
 * sidebar). This is a workspace/platform read shape, distinct from the
 * transcript-oriented `SessionReadModel`.
 */
export type SessionSummary = {
  id: string;
  providerId: ProviderId;
  providerSessionRef?: string;
  status: "idle" | "running" | "error";
  title?: string;
  preview?: string;
  repoPath: string;
  createdAt?: number;
  updatedAt?: number;
  worktreePath?: string;
  messageCount?: number;
};

export type ListSessionsInput = {
  repoPath: string;
  providerId?: ProviderId;
  markRecent?: boolean;
};

export type DeleteSessionInput = {
  repoPath: string;
  providerId?: ProviderId;
  sessionId: string;
};
