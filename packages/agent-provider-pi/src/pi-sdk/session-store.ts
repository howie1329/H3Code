import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import {
  getRegisteredSession,
  getSessionWorktree,
  listRegisteredSessionsForRepo,
  recordRepoUsage,
  removeRegisteredSession,
  removeSessionWorktreeMapping,
  type IndexedSessionPreference,
} from "@h3code/agent-metadata";
import type { SessionSummary } from "@h3code/agent-protocol";

export type ConnectionId = string;
export type ProviderId = string;
export type SessionId = string;

export type PiSessionDiscoveryOptions = {
  repoPath: string;
  providerId?: ProviderId;
  markRecent?: boolean;
  liveConnections?: ReadonlyMap<SessionId, ConnectionId>;
};

export type DeletePiSessionInput = {
  repoPath: string;
  sessionId: SessionId;
  disconnect?: (connectionId: ConnectionId) => Promise<void>;
  findConnectionIdForSession?: (sessionId: SessionId) => ConnectionId | undefined;
  liveConnections?: ReadonlyMap<SessionId, ConnectionId>;
};

export async function listPiSessionsForRepo(options: PiSessionDiscoveryOptions): Promise<SessionSummary[]> {
  const { repoPath, markRecent = false, providerId = "pi", liveConnections } = options;
  const registered = listRegisteredSessionsForRepo(repoPath);

  if (markRecent) {
    recordRepoUsage(repoPath);
  }

  const refreshed = await Promise.all(
    registered.map(async (session) => refreshRegisteredSessionMetadata(session)),
  );

  return refreshed
    .filter((session): session is IndexedSessionPreference => session !== undefined)
    .map((session) => toSessionSummary(session, providerId, liveConnections));
}

export async function deleteRegisteredSessionForRepo(input: DeletePiSessionInput) {
  const { repoPath, sessionId } = input;
  const registered = getRegisteredSession(sessionId);

  if (!registered || registered.repoPath !== repoPath) {
    throw new Error("Session does not belong to this repo.");
  }

  const sessionWorktree = getSessionWorktree(sessionId);
  const sessionCwd = sessionWorktree?.worktreePath ?? repoPath;
  const providerSessionRef = registered.providerSessionRef;

  const connectionId = input.findConnectionIdForSession?.(sessionId);

  if (connectionId && input.disconnect) {
    await input.disconnect(connectionId);
  }

  if (existsSync(providerSessionRef)) {
    await deleteSessionFile(providerSessionRef);
  }

  if (sessionWorktree) {
    removeSessionWorktreeMapping(sessionId);
  }

  removeRegisteredSession(sessionId);

  return listPiSessionsForRepo({
    repoPath,
    markRecent: true,
    liveConnections: input.liveConnections,
  });
}

async function refreshRegisteredSessionMetadata(session: IndexedSessionPreference) {
  if (!existsSync(session.providerSessionRef)) {
    removeRegisteredSession(session.id);
    return undefined;
  }

  const sessionWorktree = getSessionWorktree(session.id);
  const sessionCwd = sessionWorktree?.worktreePath ?? session.repoPath;
  const sessions = await SessionManager.list(sessionCwd);
  const providerSession = sessions.find((item) => item.path === session.providerSessionRef);

  if (!providerSession) {
    return session;
  }

  return {
    ...session,
    providerSessionId: providerSession.id,
    name: providerSession.name,
    modified: providerSession.modified.toISOString(),
    messageCount: providerSession.messageCount,
    firstMessage: providerSession.firstMessage,
  };
}

function toSessionSummary(
  session: IndexedSessionPreference,
  providerId: ProviderId,
  liveConnections?: ReadonlyMap<SessionId, ConnectionId>,
): SessionSummary {
  return {
    id: session.id,
    providerId,
    providerSessionRef: session.providerSessionRef,
    status: "idle",
    title: session.name,
    preview: session.firstMessage,
    repoPath: session.repoPath,
    createdAt: Date.parse(session.created),
    updatedAt: Date.parse(session.modified),
    worktreePath: session.worktreePath,
    messageCount: session.messageCount,
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
