import { app } from "electron";

import { type AgentServerHandle, startH3CodeAgentServer } from "@h3code/agent-server";

let serverHandle: AgentServerHandle | undefined;

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
