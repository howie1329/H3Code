import type { ProviderId, SessionRef } from "./ids.js";

export type ConnectionState = "starting" | "connected" | "disconnected" | "error" | "exited";
export type SessionStatus = "idle" | "running" | "waiting" | "error" | "archived";
export type MessageMode = "prompt" | "steer" | "followUp";
export type QueueMode = "all" | "one-at-a-time";
export type MessageSource = "extension" | "prompt" | "skill" | "interactive" | (string & {});
export type StreamingBehavior = "steer" | "followUp";

export interface SessionSummary {
  providerId: ProviderId;
  sessionRef: SessionRef;
  status: SessionStatus;
  title?: string;
  preview?: string;
  repoPath?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface SessionSnapshot {
  summary: SessionSummary;
  cwd: string;
  messages: unknown[];
  streamingMessage?: unknown;
  isStreaming: boolean;
  isCompacting: boolean;
  model?: unknown;
  thinkingLevel?: string;
  steeringMode?: QueueMode;
  followUpMode?: QueueMode;
  steering: readonly string[];
  followUp: readonly string[];
  activeTools: readonly string[];
  tools: readonly unknown[];
  stats?: unknown;
  diagnostics: readonly ProviderDiagnostic[];
  modelFallbackMessage?: string;
}

export interface MessageInput {
  text: string;
  mode: MessageMode;
  images?: unknown[];
  source?: MessageSource;
  expandPromptTemplates?: boolean;
  streamingBehavior?: StreamingBehavior;
}

export interface NewSessionOptions {
  parentSession?: SessionRef;
}

export interface ProviderDiagnostic {
  level?: "info" | "warning" | "error";
  message?: string;
  detail?: unknown;
}
