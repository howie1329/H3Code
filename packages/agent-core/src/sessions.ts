import type { MessageId, ProviderId, RunRef, SessionRef } from "./ids.js";

export type ConnectionState = "starting" | "connected" | "disconnected" | "error" | "exited";
export type SessionStatus = "idle" | "running" | "waiting" | "error" | "archived";
export type RunStatus = "queued" | "running" | "waiting" | "completed" | "failed" | "aborted";
export type MessageMode = "prompt" | "steer" | "followUp";
export type MessageRole = "user" | "assistant" | "system" | "tool";

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

export interface RunSummary {
  runRef: RunRef;
  status: RunStatus;
  startedAt?: number;
  completedAt?: number;
}

export interface TranscriptMessage {
  id: MessageId;
  role: MessageRole;
  content: unknown;
  createdAt?: number;
}

export interface SessionSnapshot {
  summary: SessionSummary;
  messages: TranscriptMessage[];
  activeRun?: RunSummary;
}

export interface MessageInput {
  text: string;
  mode: MessageMode;
}

export interface NewSessionOptions {
  title?: string;
}
