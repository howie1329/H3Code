import type { RequestId, ServerToClientMessage } from "@h3code/agent-core";

export class AgentServerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId?: RequestId,
  ) {
    super(message);
    this.name = "AgentServerError";
  }
}

export function errorMessage(error: unknown, requestId?: RequestId): ServerToClientMessage {
  if (error instanceof AgentServerError) {
    return { type: "error", id: error.requestId ?? requestId, code: error.code, message: error.message };
  }

  return {
    type: "error",
    id: requestId,
    code: "internal_error",
    message: error instanceof Error ? error.message : String(error),
  };
}
