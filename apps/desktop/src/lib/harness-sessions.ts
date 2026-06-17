import type { DesktopPreferences } from "@h3code/agent-metadata";
import type { SessionSummary } from "@h3code/agent-protocol";

import { indexedSessionToSummary, getSessionUpdatedAt } from "$lib/session-summary.js";

export function listIndexedSessionsForRepo(
  preferences: DesktopPreferences,
  repoPath: string,
): SessionSummary[] {
  return preferences.indexedSessions
    .filter((session) => session.repoPath === repoPath)
    .map(indexedSessionToSummary)
    .sort((left, right) => getSessionUpdatedAt(right) - getSessionUpdatedAt(left));
}

export function createLiveSessionSummary(input: {
  sessionId: string;
  repoPath: string;
  title?: string;
  preview?: string;
}): SessionSummary {
  const now = Date.now();

  return {
    id: input.sessionId,
    providerId: "harness-pi",
    providerSessionRef: input.sessionId,
    status: "idle",
    title: input.title ?? "New session",
    preview: input.preview ?? "",
    repoPath: input.repoPath,
    createdAt: now,
    updatedAt: now,
    worktreePath: input.repoPath,
    messageCount: 0,
  };
}
