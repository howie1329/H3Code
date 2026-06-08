export type SessionSummary = {
  id: string;
  providerId: string;
  providerSessionRef?: string;
  status: "idle" | "running" | "error";
  title?: string;
  preview?: string;
  repoPath: string;
  createdAt?: number;
  updatedAt?: number;
  worktreePath?: string;
  messageCount?: number;
  liveSessionId?: string;
};

export type ConnectionState = "disconnected" | "starting" | "connected" | "error" | "exited";

export type SessionId = string;
