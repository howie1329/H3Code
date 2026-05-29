import type {
  ConnectionId,
  DesktopSettings,
  PreferencesSnapshot,
  ProviderId,
  SessionRef,
  SessionSummary,
  WorkspaceDiffSummary,
} from "@h3code/agent-core";
import {
  clearAllIndexedData,
  getPreferences,
  removeIndexedRepo,
  setPiExecutablePath,
  updateDesktopSettings,
} from "@h3code/agent-metadata";
import type { ConnectionManager } from "../connection-manager.js";
import { getWorkspaceDiff } from "./git-diff.js";
import { deleteSessionForRepo } from "./session-delete.js";
import { listSessionsForRepo } from "./session-discovery.js";

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

    const sessions = await deleteSessionForRepo({
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
    return listSessionsForRepo({
      repoPath: input.repoPath,
      providerId: input.providerId ?? "pi",
      markRecent: input.markRecent,
      liveConnections: this.connections?.getLiveSessionConnections(input.repoPath),
    });
  }
}
