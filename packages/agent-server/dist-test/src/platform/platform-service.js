import { clearAllIndexedData, getPreferences, removeIndexedRepo, setPiExecutablePath, updateDesktopSettings, } from "@h3code/agent-metadata";
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
    removeRepo(repoPath) {
        removeIndexedRepo(repoPath);
        return this.getPreferences();
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