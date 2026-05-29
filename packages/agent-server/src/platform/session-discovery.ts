import { existsSync } from "node:fs";
import { SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";
import type { ConnectionId, ProviderId, SessionSummary } from "@h3code/agent-core";
import {
  getPreferences,
  getRepoWorktrees,
  recordRepoSessionRows,
  recordRepoUsage,
} from "@h3code/agent-metadata";

type DiscoveredSession = {
  path: string;
  id: string;
  cwd: string;
  worktreePath?: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
};

export type SessionDiscoveryOptions = {
  repoPath: string;
  providerId?: ProviderId;
  markRecent?: boolean;
  liveConnections?: ReadonlyMap<string, ConnectionId>;
};

export async function listSessionsForRepo(options: SessionDiscoveryOptions): Promise<SessionSummary[]> {
  const { repoPath, markRecent = false, providerId = "pi", liveConnections } = options;

  const discovered = includeIndexedSessionsForRepo(
    repoPath,
    await listAllSessionsForLogicalRepo(repoPath),
  );

  if (markRecent) {
    recordRepoUsage(repoPath);
  }

  recordRepoSessionRows(
    repoPath,
    discovered.map((session) => ({
      path: session.path,
      id: session.id,
      name: session.name,
      created: session.created,
      modified: session.modified,
      messageCount: session.messageCount,
      firstMessage: session.firstMessage,
    })),
  );

  const sorted = sortSessionsForRepoByIndexedRecency(repoPath, discovered);
  return sorted.map((session) => toSessionSummary(session, providerId, liveConnections));
}

async function listAllSessionsForLogicalRepo(repoPath: string): Promise<DiscoveredSession[]> {
  const sessionsByPath = new Map<string, DiscoveredSession>();

  for (const session of await SessionManager.list(repoPath)) {
    sessionsByPath.set(session.path, serializeSession(session, repoPath));
  }

  for (const worktree of getRepoWorktrees(repoPath)) {
    if (!existsSync(worktree.worktreePath)) {
      continue;
    }

    for (const session of await SessionManager.list(worktree.worktreePath)) {
      sessionsByPath.set(session.path, {
        ...serializeSession(session, repoPath),
        worktreePath: worktree.worktreePath,
      });
    }
  }

  return [...sessionsByPath.values()].sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified));
}

function includeIndexedSessionsForRepo(repoPath: string, sessions: DiscoveredSession[]) {
  const sessionsByPath = new Map(sessions.map((session) => [session.path, session]));

  for (const session of getPreferences().indexedSessions) {
    if (session.repoPath !== repoPath || sessionsByPath.has(session.path) || !existsSync(session.path)) {
      continue;
    }

    sessionsByPath.set(session.path, {
      path: session.path,
      id: session.id,
      cwd: repoPath,
      worktreePath: session.worktreePath,
      name: session.name,
      created: session.created,
      modified: session.modified,
      messageCount: session.messageCount,
      firstMessage: session.firstMessage,
    });
  }

  return [...sessionsByPath.values()];
}

function sortSessionsForRepoByIndexedRecency(repoPath: string, sessions: DiscoveredSession[]) {
  const indexedOrderByPath = new Map(
    getPreferences().indexedSessions
      .filter((session) => session.repoPath === repoPath)
      .map((session, index) => [session.path, index]),
  );

  return [...sessions].sort((a, b) => {
    const aIndex = indexedOrderByPath.get(a.path) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = indexedOrderByPath.get(b.path) ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return Date.parse(b.modified) - Date.parse(a.modified);
  });
}

function serializeSession(session: SessionInfo, cwd: string): DiscoveredSession {
  return {
    path: session.path,
    id: session.id,
    cwd,
    name: session.name,
    created: session.created.toISOString(),
    modified: session.modified.toISOString(),
    messageCount: session.messageCount,
    firstMessage: session.firstMessage,
  };
}

function toSessionSummary(
  session: DiscoveredSession,
  providerId: ProviderId,
  liveConnections?: ReadonlyMap<string, ConnectionId>,
): SessionSummary {
  const liveConnectionId = liveConnections?.get(session.path);

  return {
    providerId,
    sessionRef: session.path,
    status: "idle",
    title: session.name,
    preview: session.firstMessage,
    repoPath: session.cwd,
    createdAt: Date.parse(session.created),
    updatedAt: Date.parse(session.modified),
    worktreePath: session.worktreePath,
    messageCount: session.messageCount,
    liveConnectionId,
  };
}
