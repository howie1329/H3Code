import type { SessionId } from "@h3code/agent-protocol";

export type ConnectionState = "disconnected" | "starting" | "connected" | "error" | "exited";

export type ConnectionStatus = {
  state: ConnectionState;
  sessionId?: SessionId;
  repoPath?: string;
  message?: string;
};

export function connectionStatusLabel(status: ConnectionStatus): string {
  switch (status.state) {
    case "connected":
      return "Connected";
    case "starting":
      return "Starting";
    case "exited":
      return "Exited";
    case "error":
      return "Error";
    case "disconnected":
      return "Disconnected";
    default:
      return status.state;
  }
}

export function connectionStatusDotClass(status: ConnectionStatus): string {
  switch (status.state) {
    case "connected":
      return "bg-primary";
    case "starting":
      return "bg-muted-foreground animate-pulse";
    case "exited":
    case "error":
    case "disconnected":
      return "bg-destructive/80";
    default:
      return "bg-muted-foreground";
  }
}
