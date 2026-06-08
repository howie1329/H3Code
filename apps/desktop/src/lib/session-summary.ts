import type { IndexedSessionPreference } from "@h3code/agent-metadata";

import type { SessionSummary } from "$lib/session-types.js";

export function indexedSessionToSummary(session: IndexedSessionPreference): SessionSummary {
  return {
    providerId: "pi",
    sessionRef: session.path,
    status: "idle",
    title: session.name,
    preview: session.firstMessage,
    repoPath: session.repoPath,
    createdAt: toTimestamp(session.created),
    updatedAt: toTimestamp(session.modified),
    worktreePath: session.worktreePath ?? session.repoPath,
    messageCount: session.messageCount,
  };
}

export function getSessionUpdatedAt(summary: SessionSummary): number {
  return summary.updatedAt ?? summary.createdAt ?? 0;
}

export function formatSessionUpdatedAt(summary: SessionSummary): string {
  const timestamp = getSessionUpdatedAt(summary);

  if (!timestamp) {
    return "";
  }

  return formatRelativeTime(new Date(timestamp));
}

function toTimestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function formatRelativeTime(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}
