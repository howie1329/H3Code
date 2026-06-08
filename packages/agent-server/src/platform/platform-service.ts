import type {
  ConnectionId,
  DesktopSettings,
  PreferencesSnapshot,
  ProviderId,
  SessionMessageCacheEntry,
  SessionMessageCacheUpsert,
  SessionRef,
  SessionSummary,
  WorkspaceDiffSummary,
} from "@h3code/agent-core";
import { deletePiSessionForRepo, listPiSessionsForRepo } from "@h3code/pi-provider";
import {
  clearAllIndexedData,
  deleteSessionMessageCache as deleteMetadataSessionMessageCache,
  getPreferences,
  getSessionMessageCache as getMetadataSessionMessageCache,
  removeIndexedRepo,
  setPiExecutablePath,
  updateDesktopSettings,
  upsertSessionMessageCache as upsertMetadataSessionMessageCache,
  type SessionMessageCacheUpsert as MetadataSessionMessageCacheUpsert,
} from "@h3code/agent-metadata";
import type { ConnectionManager } from "../connection-manager.js";
import { getWorkspaceDiff } from "./git-diff.js";

export class PlatformService {
  constructor(private readonly connections?: ConnectionManager) {}

  getPreferences(): PreferencesSnapshot {
    return getPreferences();
  }

  updateDesktopSettings(settings: Partial<DesktopSettings>) {
    updateDesktopSettings(settings);
    return this.getPreferences();
  }

  setPiExecutablePath(path: string) {
    setPiExecutablePath(path);
    return this.getPreferences();
  }

  async removeRepo(repoPath: string) {
    await this.connections?.disconnectForRepo(repoPath);
    removeIndexedRepo(repoPath);
    return this.getPreferences();
  }

  async deleteSession(input: {
    repoPath: string;
    sessionRef: SessionRef;
    connectionId?: ConnectionId;
  }) {
    const findConnectionIdForSession = (sessionRef: SessionRef) => {
      if (input.connectionId) {
        return input.connectionId;
      }

      return this.connections?.findConnectionIdForSession(sessionRef);
    };

    const repoPath = input.repoPath;

    const sessions = await deletePiSessionForRepo({
      repoPath,
      sessionRef: input.sessionRef,
      findConnectionIdForSession,
      disconnect: async (connectionId) => {
        await this.connections?.disconnect(connectionId);
      },
      liveConnections: this.connections?.getLiveSessionConnections(repoPath),
    });

    return sessions;
  }

  async getWorkspaceDiff(connectionId: ConnectionId): Promise<WorkspaceDiffSummary> {
    const repoPath = this.connections?.getRepoPath(connectionId);

    if (!repoPath) {
      throw new Error("Unknown connection.");
    }

    return getWorkspaceDiff(repoPath);
  }

  clearIndexed() {
    clearAllIndexedData();
    return this.getPreferences();
  }

  async listSessions(input: {
    repoPath: string;
    providerId?: ProviderId;
    markRecent?: boolean;
  }): Promise<SessionSummary[]> {
    return listPiSessionsForRepo({
      repoPath: input.repoPath,
      providerId: input.providerId ?? "pi",
      markRecent: input.markRecent,
      liveConnections: this.connections?.getLiveSessionConnections(input.repoPath),
    });
  }

  getSessionMessageCache(sessionRef: SessionRef): SessionMessageCacheEntry | undefined {
    const entry = getMetadataSessionMessageCache(sessionRef);

    if (!entry) {
      return undefined;
    }

    return toCoreSessionMessageCacheEntry(entry);
  }

  upsertSessionMessageCache(entry: SessionMessageCacheUpsert) {
    upsertMetadataSessionMessageCache(toMetadataSessionMessageCacheUpsert(entry));
  }

  deleteSessionMessageCache(sessionRef: SessionRef) {
    deleteMetadataSessionMessageCache(sessionRef);
  }
}

function toCoreSessionMessageCacheEntry(entry: NonNullable<ReturnType<typeof getMetadataSessionMessageCache>>): SessionMessageCacheEntry {
  return {
    sessionRef: entry.sessionPath,
    repoPath: entry.repoPath,
    providerId: entry.providerId,
    messages: entry.messages,
    sessionState: entry.sessionState
      ? {
          isStreaming: entry.sessionState.isStreaming,
          isCompacting: entry.sessionState.isCompacting,
          sessionRef: entry.sessionState.sessionFile,
          sessionId: entry.sessionState.sessionId,
        }
      : undefined,
    messageCount: entry.messageCount,
    sourceMtimeMs: entry.sourceMtimeMs,
    sourceSizeBytes: entry.sourceSizeBytes,
    contentHash: entry.contentHash,
    cachedAt: entry.cachedAt,
    syncedAt: entry.syncedAt,
    lastOpenedAt: entry.lastOpenedAt,
    syncStatus: entry.syncStatus,
  };
}

function toMetadataSessionMessageCacheUpsert(entry: SessionMessageCacheUpsert): MetadataSessionMessageCacheUpsert {
  return {
    sessionPath: entry.sessionRef,
    repoPath: entry.repoPath,
    providerId: entry.providerId,
    messages: entry.messages,
    sessionState: entry.sessionState
      ? {
          isStreaming: entry.sessionState.isStreaming,
          isCompacting: entry.sessionState.isCompacting,
          sessionFile: entry.sessionState.sessionRef,
          sessionId: entry.sessionState.sessionId,
        }
      : undefined,
    messageCount: entry.messageCount,
    sourceMtimeMs: entry.sourceMtimeMs,
    sourceSizeBytes: entry.sourceSizeBytes,
    contentHash: entry.contentHash,
    cachedAt: entry.cachedAt,
    syncedAt: entry.syncedAt,
    lastOpenedAt: entry.lastOpenedAt,
    syncStatus: entry.syncStatus,
  };
}
