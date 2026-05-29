import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getSessionWorktree, removeIndexedSession } from "@h3code/agent-metadata";
import { listSessionsForRepo } from "./session-discovery.js";
export async function deleteSessionForRepo(input) {
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
    const removeWorktreeMapping = sessionWorktree ? true : false;
    removeIndexedSession(sessionRef, { removeWorktreeMapping });
    return listSessionsForRepo({
        repoPath,
        markRecent: true,
        liveConnections: input.liveConnections,
    });
}
async function deleteSessionFile(sessionPath) {
    const trashArgs = sessionPath.startsWith("-") ? ["--", sessionPath] : [sessionPath];
    const trashResult = spawnSync("trash", trashArgs, { encoding: "utf-8" });
    if (trashResult.status === 0 || !existsSync(sessionPath)) {
        return;
    }
    await unlink(sessionPath);
}
//# sourceMappingURL=session-delete.js.map