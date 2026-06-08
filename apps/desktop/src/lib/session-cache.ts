import type { SessionSnapshot, WorkspaceDiffSummary } from "@h3code/agent-core";

import { cloneSessionReadModel } from "./pi-session/projector.js";
import type { SessionReadModel } from "./pi-session/read-model.js";
import type { SessionStats } from "./session-stats.js";

export const SESSION_CACHE_MAX_SIZE = 20;

export type SessionCacheEntry = {
  sessionRef: string;
  sessionReadModel: SessionReadModel;
  sessionSnapshot: SessionSnapshot;
  worktreePath?: string;
  sessionStats?: SessionStats | null;
  sessionDiff?: WorkspaceDiffSummary;
  lastAccessedAt: number;
};

export type SessionCacheMap = Record<string, SessionCacheEntry>;

export { cloneSessionReadModel };

function cloneSessionSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
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

export function getCachedSession(cache: SessionCacheMap, sessionRef: string): SessionCacheEntry | undefined {
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

export function setCachedSession(
  cache: SessionCacheMap,
  entry: SessionCacheEntry,
  maxSize = SESSION_CACHE_MAX_SIZE,
): SessionCacheMap {
  const next: SessionCacheMap = {
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

  let oldestRef = keys[0]!;
  let oldestAccessedAt = next[oldestRef]!.lastAccessedAt;

  for (const sessionRef of keys) {
    if (sessionRef === entry.sessionRef) {
      continue;
    }

    const candidate = next[sessionRef]!;

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

export function deleteCachedSession(cache: SessionCacheMap, sessionRef: string): SessionCacheMap {
  if (!(sessionRef in cache)) {
    return cache;
  }

  const next = { ...cache };
  delete next[sessionRef];
  return next;
}

export function clearSessionCache(): SessionCacheMap {
  return {};
}
