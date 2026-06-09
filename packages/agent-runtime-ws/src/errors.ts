import type { ProtocolError } from "@h3code/agent-protocol";

export function toProtocolError(error: unknown, requestId?: string): ProtocolError {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    return { code: String(error.code), message: String(error.message), requestId };
  }
  return { code: "runtime_ws_error", message: error instanceof Error ? error.message : "Unknown WebSocket runtime error", requestId };
}
