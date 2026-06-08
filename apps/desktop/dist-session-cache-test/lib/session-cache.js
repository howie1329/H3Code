import { cloneSessionReadModel } from "./pi-session/projector.js";
export const SESSION_CACHE_MAX_SIZE = 20;
export { cloneSessionReadModel };
function cloneSessionSnapshot(snapshot) {
    return {
        ...snapshot,
        summary: { ...snapshot.summary },
        messages: [...snapshot.messages],
        steering: [...snapshot.steering],
        followUp: [...snapshot.followUp],
        activeTools: [...snapshot.activeTools],
        tools: [...snapshot.tools],
        diagnostics: [...snapshot.diagnostics],
    };
}
export function getCachedSession(cache, sessionRef) {
    const entry = cache[sessionRef];
    if (!entry) {
        return undefined;
    }
    return {
        ...entry,
        sessionReadModel: cloneSessionReadModel(entry.sessionReadModel),
        sessionSnapshot: cloneSessionSnapshot(entry.sessionSnapshot),
        sessionStats: entry.sessionStats ? { ...entry.sessionStats, tokens: { ...entry.sessionStats.tokens } } : entry.sessionStats,
        sessionDiff: entry.sessionDiff ? { ...entry.sessionDiff, files: [...entry.sessionDiff.files] } : undefined,
    };
}
export function setCachedSession(cache, entry, maxSize = SESSION_CACHE_MAX_SIZE) {
    const next = {
        ...cache,
        [entry.sessionRef]: {
            ...entry,
            sessionReadModel: cloneSessionReadModel(entry.sessionReadModel),
            sessionSnapshot: cloneSessionSnapshot(entry.sessionSnapshot),
            sessionStats: entry.sessionStats ? { ...entry.sessionStats, tokens: { ...entry.sessionStats.tokens } } : entry.sessionStats,
            sessionDiff: entry.sessionDiff ? { ...entry.sessionDiff, files: [...entry.sessionDiff.files] } : undefined,
            lastAccessedAt: entry.lastAccessedAt,
        },
    };
    const keys = Object.keys(next);
    if (keys.length <= maxSize) {
        return next;
    }
    let oldestRef = keys[0];
    let oldestAccessedAt = next[oldestRef].lastAccessedAt;
    for (const sessionRef of keys) {
        if (sessionRef === entry.sessionRef) {
            continue;
        }
        const candidate = next[sessionRef];
        if (candidate.lastAccessedAt < oldestAccessedAt) {
            oldestRef = sessionRef;
            oldestAccessedAt = candidate.lastAccessedAt;
        }
    }
    if (oldestRef !== entry.sessionRef) {
        delete next[oldestRef];
    }
    return next;
}
export function deleteCachedSession(cache, sessionRef) {
    if (!(sessionRef in cache)) {
        return cache;
    }
    const next = { ...cache };
    delete next[sessionRef];
    return next;
}
export function clearSessionCache() {
    return {};
}
//# sourceMappingURL=session-cache.js.map