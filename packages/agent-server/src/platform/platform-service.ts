import type {
  DesktopSettings,
  PreferencesSnapshot,
  ProviderId,
  SessionSummary,
} from "@h3code/agent-core";
import {
  clearAllIndexedData,
  getPreferences,
  removeIndexedRepo,
  setPiExecutablePath,
  updateDesktopSettings,
} from "@h3code/agent-metadata";
import type { ConnectionManager } from "../connection-manager.js";
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

  removeRepo(repoPath: string) {
    removeIndexedRepo(repoPath);
    return this.getPreferences();
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
