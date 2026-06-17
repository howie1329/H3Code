import { HarnessSessionManager } from "./harness-session-manager.js";
import { createHarnessHttpServer, type HarnessHttpServer } from "./harness-http-server.js";

export type HarnessHostHandle = {
  sessionManager: HarnessSessionManager;
  http: HarnessHttpServer;
  chatUrl: string;
  close: () => Promise<void>;
};

let harnessHost: HarnessHostHandle | undefined;

export async function startHarnessHost(): Promise<HarnessHostHandle> {
  if (harnessHost) {
    return harnessHost;
  }

  const sessionManager = new HarnessSessionManager();
  const http = await createHarnessHttpServer(sessionManager);

  harnessHost = {
    sessionManager,
    http,
    chatUrl: http.chatUrl,
    close: async () => {
      await sessionManager.closeAll();
      await http.close();
      harnessHost = undefined;
    },
  };

  return harnessHost;
}

export function getHarnessChatUrl(): string | undefined {
  return harnessHost?.chatUrl;
}

export async function stopHarnessHost(): Promise<void> {
  if (!harnessHost) {
    return;
  }

  await harnessHost.close();
}
