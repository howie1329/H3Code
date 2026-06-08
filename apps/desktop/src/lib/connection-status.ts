import type { ConnectionId, ConnectionState } from "@h3code/agent-core";

export type ConnectionStatus = {
  state: ConnectionState;
  connectionId?: ConnectionId;
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
