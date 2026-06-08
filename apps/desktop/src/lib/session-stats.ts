import type { SessionReadModel } from "@h3code/agent-protocol";

export type SessionStats = {
  sessionId?: string;
  totalMessages?: number;
  userMessages?: number;
  assistantMessages?: number;
  toolCalls?: number;
  toolResults?: number;
  contextUsage?: {
    percent?: number;
    tokens?: number;
    contextWindow?: number;
  };
};

export function parseSessionStats(session: SessionReadModel | undefined): SessionStats | null {
  if (!session) {
    return null;
  }

  const userMessages = session.messages.filter((message) => message.role === "user").length;
  const assistantMessages = session.messages.filter((message) => message.role === "assistant").length;
  const toolCalls = session.activities.filter((activity) => activity.kind === "tool").length;
  const toolResults = session.activities.filter(
    (activity) => activity.kind === "tool" && activity.status === "completed",
  ).length;

  return {
    sessionId: session.id,
    totalMessages: session.messages.length,
    userMessages,
    assistantMessages,
    toolCalls,
    toolResults,
  };
}

export function sessionRefToId(sessionRef: string) {
  const base = sessionRef.split(/[/\\]/).pop() ?? sessionRef;
  return base.replace(/\.jsonl$/i, "");
}
