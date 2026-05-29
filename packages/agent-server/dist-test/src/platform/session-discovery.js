import { existsSync } from "node:fs";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getPreferences, getRepoWorktrees, recordRepoSessionRows, recordRepoUsage, } from "@h3code/agent-metadata";
export async function listSessionsForRepo(options) {
    const { repoPath, markRecent = false, providerId = "pi", liveConnections } = options;
    const discovered = includeIndexedSessionsForRepo(repoPath, await listAllSessionsForLogicalRepo(repoPath));
    if (markRecent) {
        recordRepoUsage(repoPath);
    }
    recordRepoSessionRows(repoPath, discovered.map((session) => ({
        path: session.path,
        id: session.id,
        name: session.name,
        created: session.created,
        modified: session.modified,
        messageCount: session.messageCount,
        firstMessage: session.firstMessage,
    })));
    const sorted = sortSessionsForRepoByIndexedRecency(repoPath, discovered);
    return sorted.map((session) => toSessionSummary(session, providerId, liveConnections));
}
async function listAllSessionsForLogicalRepo(repoPath) {
    const sessionsByPath = new Map();
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
function includeIndexedSessionsForRepo(repoPath, sessions) {
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
function sortSessionsForRepoByIndexedRecency(repoPath, sessions) {
    const indexedOrderByPath = new Map(getPreferences().indexedSessions
        .filter((session) => session.repoPath === repoPath)
        .map((session, index) => [session.path, index]));
    return [...sessions].sort((a, b) => {
        const aIndex = indexedOrderByPath.get(a.path) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = indexedOrderByPath.get(b.path) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) {
            return aIndex - bIndex;
        }
        return Date.parse(b.modified) - Date.parse(a.modified);
    });
}
function serializeSession(session, cwd) {
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
function toSessionSummary(session, providerId, liveConnections) {
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
//# sourceMappingURL=session-discovery.js.map