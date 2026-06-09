import { app } from "electron";

import {
  type H3CodeRuntimeServerHandle,
  startH3CodeRuntimeServer,
} from "@h3code/agent-runtime-server";

let serverHandle: H3CodeRuntimeServerHandle | undefined;

export async function startAgentServerProcess(): Promise<H3CodeRuntimeServerHandle> {
  if (serverHandle) {
    return serverHandle;
  }

  serverHandle = await startH3CodeRuntimeServer({
    host: "127.0.0.1",
    port: 0,
    dataDir: app.getPath("userData"),
  });

  return serverHandle;
}

export function getAgentServerUrl(): string | undefined {
  if (!serverHandle?.port) {
    return undefined;
  }

  return `ws://127.0.0.1:${serverHandle.port}`;
}

export async function stopAgentServerProcess(): Promise<void> {
  if (!serverHandle) {
    return;
  }

  await serverHandle.close();
  serverHandle = undefined;
}
