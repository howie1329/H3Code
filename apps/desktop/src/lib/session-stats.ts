import type { SessionSnapshot } from "@h3code/agent-core";

export type SessionStats = {
  sessionRef?: string;
  sessionId: string;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  totalMessages: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
  contextUsage?: {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  };
};

export function parseSessionStats(snapshot: SessionSnapshot): SessionStats | null {
  const stats = snapshot.stats;

  if (!stats || typeof stats !== "object") {
    return null;
  }

  const record = stats as Record<string, unknown>;
  const tokens = toRecord(record.tokens);
  const contextUsage = toRecord(record.contextUsage);

  return {
    sessionRef: snapshot.summary.sessionRef,
    sessionId: sessionRefToId(snapshot.summary.sessionRef),
    userMessages: numberOrZero(record.userMessages),
    assistantMessages: numberOrZero(record.assistantMessages),
    toolCalls: numberOrZero(record.toolCalls),
    toolResults: numberOrZero(record.toolResults),
    totalMessages: numberOrZero(record.totalMessages),
    tokens: {
      input: numberOrZero(tokens.input),
      output: numberOrZero(tokens.output),
      cacheRead: numberOrZero(tokens.cacheRead),
      cacheWrite: numberOrZero(tokens.cacheWrite),
      total: numberOrZero(tokens.total),
    },
    cost: typeof record.cost === "number" ? record.cost : 0,
    contextUsage: contextUsage
      ? {
          tokens: typeof contextUsage.tokens === "number" ? contextUsage.tokens : null,
          contextWindow: numberOrZero(contextUsage.contextWindow),
          percent: typeof contextUsage.percent === "number" ? contextUsage.percent : null,
        }
      : undefined,
  };
}

export function sessionRefToId(sessionRef: string): string {
  const base = sessionRef.split("/").pop() ?? sessionRef;
  return base.replace(/\.jsonl?$/i, "");
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
