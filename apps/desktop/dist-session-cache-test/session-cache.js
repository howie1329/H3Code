import { cloneSessionReadModel } from "$lib/pi-session/projector.js";
export const SESSION_CACHE_MAX_SIZE = 20;
export { cloneSessionReadModel };
export function getCachedSession(cache, sessionPath) {
    const entry = cache[sessionPath];
    if (!entry) {
        return undefined;
    }
    return {
        ...entry,
        sessionReadModel: cloneSessionReadModel(entry.sessionReadModel),
        sessionState: { ...entry.sessionState },
        sessionStats: entry.sessionStats ? { ...entry.sessionStats } : entry.sessionStats,
        sessionDiff: entry.sessionDiff ? { ...entry.sessionDiff, changedFiles: entry.sessionDiff.changedFiles } : undefined,
    };
}
export function setCachedSession(cache, entry, maxSize = SESSION_CACHE_MAX_SIZE) {
    const next = {
        ...cache,
        [entry.sessionPath]: {
            ...entry,
            sessionReadModel: cloneSessionReadModel(entry.sessionReadModel),
            sessionState: { ...entry.sessionState },
            sessionStats: entry.sessionStats ? { ...entry.sessionStats } : entry.sessionStats,
            sessionDiff: entry.sessionDiff ? { ...entry.sessionDiff } : undefined,
            lastAccessedAt: entry.lastAccessedAt,
        },
    };
    const keys = Object.keys(next);
    if (keys.length <= maxSize) {
        return next;
    }
    let oldestPath = keys[0];
    let oldestAccessedAt = next[oldestPath].lastAccessedAt;
    for (const sessionPath of keys) {
        if (sessionPath === entry.sessionPath) {
            continue;
        }
        const candidate = next[sessionPath];
        if (candidate.lastAccessedAt < oldestAccessedAt) {
            oldestPath = sessionPath;
            oldestAccessedAt = candidate.lastAccessedAt;
        }
    }
    if (oldestPath !== entry.sessionPath) {
        delete next[oldestPath];
    }
    return next;
}
export function deleteCachedSession(cache, sessionPath) {
    if (!(sessionPath in cache)) {
        return cache;
    }
    const next = { ...cache };
    delete next[sessionPath];
    return next;
}
export function clearSessionCache() {
    return {};
}
//# sourceMappingURL=session-cache.js.map