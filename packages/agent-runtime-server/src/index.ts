import {
  deleteRegisteredSessionForRepo,
  listPiSessionsForRepo,
  PiProviderAdapter,
  type PiProviderAdapterOptions,
} from "@h3code/agent-provider-pi";
import { AgentRuntime, type AgentRuntimeOptions } from "@h3code/agent-runtime";
import {
  configurePersistenceStore,
  createRuntimePersistence,
  resolvePersistenceDataDir,
} from "@h3code/agent-runtime-persistence";
import { createAgentRuntimeWsServer, type WorkspaceService } from "@h3code/agent-runtime-ws";
import {
  isRegisteredSession,
  registerH3CodeSession,
  touchRegisteredSession,
} from "@h3code/agent-metadata";
import type { WebSocketServer } from "ws";

export type H3CodeRuntimeServerOptions = {
  port?: number;
  host?: string;
  dataDir?: string;
  runtime?: AgentRuntime;
  runtimeOptions?: AgentRuntimeOptions;
  piProviderOptions?: PiProviderAdapterOptions;
  registerPiProvider?: boolean;
  workspace?: WorkspaceService;
};

const piWorkspaceService: WorkspaceService = {
  listSessions: (input) =>
    listPiSessionsForRepo({
      repoPath: input.repoPath,
      providerId: input.providerId ?? "pi",
      markRecent: input.markRecent,
    }),
  deleteSession: (input) =>
    deleteRegisteredSessionForRepo({
      repoPath: input.repoPath,
      sessionId: input.sessionId,
    }),
  assertRegisteredSession(sessionId) {
    if (!isRegisteredSession(sessionId)) {
      throw Object.assign(new Error(`Session is not registered with H3Code: ${sessionId}`), { code: "session_not_registered" });
    }
  },
  registerSession(session, binding) {
    registerH3CodeSession({
      h3codeSessionId: session.id,
      repoPath: session.repoPath,
      providerId: session.providerId,
      providerSessionRef: binding.providerSessionRef ?? session.providerSessionRef ?? "",
      name: session.title,
      messageCount: session.messages.length,
      firstMessage: session.messages.find((message) => message.role === "user")?.content ?? "",
    });
  },
  touchSession(sessionId) {
    touchRegisteredSession(sessionId);
  },
};

export type H3CodeRuntimeServerHandle = {
  runtime: AgentRuntime;
  wsServer: WebSocketServer;
  port?: number;
  close(): Promise<void>;
};

export async function startH3CodeRuntimeServer(options: H3CodeRuntimeServerOptions = {}): Promise<H3CodeRuntimeServerHandle> {
  const dataDir = resolvePersistenceDataDir(options.dataDir);
  configurePersistenceStore({ dataDir });
  const persistence = createRuntimePersistence();

  const runtime = options.runtime ?? new AgentRuntime({
    ...options.runtimeOptions,
    persistence,
  });
  await runtime.loadPersistedState();

  const shouldRegisterPiProvider = options.registerPiProvider ?? !options.runtime;
  if (shouldRegisterPiProvider) {
    runtime.registerProvider(new PiProviderAdapter(options.piProviderOptions));
  }

  const workspace = options.workspace ?? piWorkspaceService;
  const wsServer = createAgentRuntimeWsServer({ runtime, workspace, port: options.port ?? 0, host: options.host });

  await new Promise<void>((resolve, reject) => {
    if (wsServer.address()) {
      resolve();
      return;
    }
    wsServer.once("listening", resolve);
    wsServer.once("error", reject);
  });

  const address = wsServer.address();
  const port = typeof address === "object" && address ? address.port : options.port;

  return {
    runtime,
    wsServer,
    port,
    close: async () => {
      await runtime.stopAll();
      await new Promise<void>((resolve, reject) => {
        wsServer.close((error?: Error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

export { AgentRuntime } from "@h3code/agent-runtime";
export { createAgentRuntimeWsServer } from "@h3code/agent-runtime-ws";
export { PiProviderAdapter } from "@h3code/agent-provider-pi";
