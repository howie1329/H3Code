export type AgentTransport = "ipc" | "ws";

export function getAgentTransport(): AgentTransport {
  const viteTransport = import.meta.env.VITE_H3CODE_AGENT_TRANSPORT;

  if (viteTransport === "ws" || viteTransport === "ipc") {
    return viteTransport;
  }

  const preloadTransport = typeof window !== "undefined" ? window.h3code?.getAgentTransport?.() : undefined;

  if (preloadTransport === "ws" || preloadTransport === "ipc") {
    return preloadTransport;
  }

  return "ipc";
}

export function usesLegacyAgentTransport(transport = getAgentTransport()): boolean {
  return transport === "ipc";
}

/** @deprecated Use desktop-state capability flags (`supportsSlashCommands`, etc.) instead. */
export function usesLegacyAgentControls(transport = getAgentTransport()): boolean {
  return usesLegacyAgentTransport(transport);
}
