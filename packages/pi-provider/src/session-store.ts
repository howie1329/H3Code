import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";
import type { ConnectionId, ProviderId, SessionRef, SessionSummary } from "@h3code/agent-core";
import {
  getIndexedSessionsForRepo,
  getRepoWorktrees,
  getSessionWorktree,
  recordRepoSessionRows,
  recordRepoUsage,
  removeIndexedSession,
  type IndexedSessionPreference,
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

export type PiSessionDiscoveryOptions = {
  repoPath: string;
  providerId?: ProviderId;
  markRecent?: boolean;
  liveConnections?: ReadonlyMap<string, ConnectionId>;
};

export type DeletePiSessionInput = {
  repoPath: string;
  sessionRef: SessionRef;
  disconnect?: (connectionId: ConnectionId) => Promise<void>;
  findConnectionIdForSession?: (sessionRef: SessionRef) => ConnectionId | undefined;
  liveConnections?: ReadonlyMap<string, ConnectionId>;
};

export async function listPiSessionsForRepo(options: PiSessionDiscoveryOptions): Promise<SessionSummary[]> {
  const { repoPath, markRecent = false, providerId = "pi", liveConnections } = options;
  const indexedSessions = getIndexedSessionsForRepo(repoPath);
  const discovered = includeIndexedSessionsForRepo(
    repoPath,
    await listAllSessionsForLogicalRepo(repoPath),
    indexedSessions,
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

  const sorted = sortSessionsForRepoByIndexedRecency(discovered, indexedSessions);
  return sorted.map((session) => toSessionSummary(session, providerId, liveConnections));
}

export async function deletePiSessionForRepo(input: DeletePiSessionInput) {
  const { repoPath, sessionRef } = input;
  const sessionWorktree = getSessionWorktree(sessionRef);
  const sessionCwd = sessionWorktree?.worktreePath ?? repoPath;
  const sessions = await SessionManager.list(sessionCwd);
  const session = sessions.find((item) => item.path === sessionRef);

  if (!session) {
    throw new Error("Session does not belong to this repo.");
  }

  const connectionId = input.findConnectionIdForSession?.(sessionRef);

  if (connectionId && input.disconnect) {
    await input.disconnect(connectionId);
  }

  await deleteSessionFile(sessionRef);
  removeIndexedSession(sessionRef, { removeWorktreeMapping: Boolean(sessionWorktree) });

  return listPiSessionsForRepo({
    repoPath,
    markRecent: true,
    liveConnections: input.liveConnections,
  });
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

function includeIndexedSessionsForRepo(
  repoPath: string,
  sessions: DiscoveredSession[],
  indexedSessions: IndexedSessionPreference[],
) {
  const sessionsByPath = new Map(sessions.map((session) => [session.path, session]));

  for (const session of indexedSessions) {
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

function sortSessionsForRepoByIndexedRecency(
  sessions: DiscoveredSession[],
  indexedSessions: IndexedSessionPreference[],
) {
  const indexedOrderByPath = new Map(indexedSessions.map((session, index) => [session.path, index]));

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

async function deleteSessionFile(sessionPath: string): Promise<void> {
  const trashArgs = sessionPath.startsWith("-") ? ["--", sessionPath] : [sessionPath];
  const trashResult = spawnSync("trash", trashArgs, { encoding: "utf-8" });

  if (trashResult.status === 0 || !existsSync(sessionPath)) {
    return;
  }

  await unlink(sessionPath);
}
