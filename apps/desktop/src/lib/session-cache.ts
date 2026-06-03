import { cloneSessionReadModel } from "./pi-session/projector.js";
import type { SessionReadModel } from "./pi-session/read-model.js";

export const SESSION_CACHE_MAX_SIZE = 20;

export type SessionCacheEntry = {
  sessionPath: string;
  sessionReadModel: SessionReadModel;
  sessionState: PiSessionState;
  worktreePath?: string;
  sessionStats?: PiSessionStats | null;
  sessionDiff?: PiSessionDiff;
  lastAccessedAt: number;
};

export type SessionCacheMap = Record<string, SessionCacheEntry>;

export { cloneSessionReadModel };

export function getCachedSession(cache: SessionCacheMap, sessionPath: string): SessionCacheEntry | undefined {
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

export function setCachedSession(
  cache: SessionCacheMap,
  entry: SessionCacheEntry,
  maxSize = SESSION_CACHE_MAX_SIZE,
): SessionCacheMap {
  const next: SessionCacheMap = {
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

  let oldestPath = keys[0]!;
  let oldestAccessedAt = next[oldestPath]!.lastAccessedAt;

  for (const sessionPath of keys) {
    if (sessionPath === entry.sessionPath) {
      continue;
    }

    const candidate = next[sessionPath]!;

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

export function deleteCachedSession(cache: SessionCacheMap, sessionPath: string): SessionCacheMap {
  if (!(sessionPath in cache)) {
    return cache;
  }

  const next = { ...cache };
  delete next[sessionPath];
  return next;
}

export function clearSessionCache(): SessionCacheMap {
  return {};
}
