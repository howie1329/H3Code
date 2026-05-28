import { app } from "electron";

import { type AgentServerHandle, startH3CodeAgentServer } from "@h3code/agent-server";

let serverHandle: AgentServerHandle | undefined;

export function getAgentTransportFromEnv(): "ipc" | "ws" {
  return process.env.H3CODE_AGENT_TRANSPORT === "ws" ? "ws" : "ipc";
}

export async function startAgentServerProcess(): Promise<AgentServerHandle> {
  if (serverHandle) {
    return serverHandle;
  }

  serverHandle = await startH3CodeAgentServer({
    dataDir: app.getPath("userData"),
  });

  return serverHandle;
}

export function getAgentServerUrl(): string | undefined {
  return serverHandle?.url;
}

export async function stopAgentServerProcess(): Promise<void> {
  if (!serverHandle) {
    return;
  }

  await serverHandle.close();
  serverHandle = undefined;
}
