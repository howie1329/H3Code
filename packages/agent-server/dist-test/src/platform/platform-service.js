import { clearAllIndexedData, getPreferences, removeIndexedRepo, setPiExecutablePath, updateDesktopSettings, } from "@h3code/agent-metadata";
import { getWorkspaceDiff } from "./git-diff.js";
import { deleteSessionForRepo } from "./session-delete.js";
import { listSessionsForRepo } from "./session-discovery.js";
export class PlatformService {
    connections;
    constructor(connections) {
        this.connections = connections;
    }
    getPreferences() {
        return getPreferences();
    }
    updateDesktopSettings(settings) {
        updateDesktopSettings(settings);
        return this.getPreferences();
    }
    setPiExecutablePath(path) {
        setPiExecutablePath(path);
        return this.getPreferences();
    }
    async removeRepo(repoPath) {
        await this.connections?.disconnectForRepo(repoPath);
        removeIndexedRepo(repoPath);
        return this.getPreferences();
    }
    async deleteSession(input) {
        const findConnectionIdForSession = (sessionRef) => {
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
    async getWorkspaceDiff(connectionId) {
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
    async listSessions(input) {
        return listSessionsForRepo({
            repoPath: input.repoPath,
            providerId: input.providerId ?? "pi",
            markRecent: input.markRecent,
            liveConnections: this.connections?.getLiveSessionConnections(input.repoPath),
        });
    }
}
//# sourceMappingURL=platform-service.js.map