import type { HarnessAgentSession } from "@ai-sdk/harness/agent";
import { HarnessAgent } from "@ai-sdk/harness/agent";
import {
  createDesktopPiAgent,
  resolveDesktopHarnessConfig,
  type DesktopAuthConfig,
} from "@h3code/agent-provider-pi/harness";
import { registerH3CodeSession } from "@h3code/agent-metadata";
import type { UIMessage } from "ai";

type ActiveStream = {
  abortController: AbortController;
};

export type HarnessStreamChatInput = {
  sessionId: string;
  repoPath: string;
  messages: UIMessage[];
  abortSignal?: AbortSignal;
};

export type HarnessSessionManagerOptions = {
  authConfig?: DesktopAuthConfig;
};

function extractLastUserPrompt(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }

    const text = message.parts
      .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  throw new Error("No user message found in chat request.");
}

export class HarnessSessionManager {
  readonly #authConfig?: DesktopAuthConfig;
  readonly #agents = new Map<string, HarnessAgent>();
  readonly #sessions = new Map<string, HarnessAgentSession>();
  readonly #sessionRepos = new Map<string, string>();
  readonly #activeStreams = new Map<string, ActiveStream>();

  constructor(options: HarnessSessionManagerOptions = {}) {
    this.#authConfig = options.authConfig;
  }

  async ensureAgent(repoPath: string): Promise<HarnessAgent> {
    const resolvedRepoPath = repoPath;
    const existing = this.#agents.get(resolvedRepoPath);
    if (existing) {
      return existing;
    }

    const harnessConfig = resolveDesktopHarnessConfig(this.#authConfig);
    const agent = await createDesktopPiAgent({
      repoPath: resolvedRepoPath,
      auth: harnessConfig.auth,
      model: harnessConfig.model,
      thinkingLevel: harnessConfig.thinkingLevel,
    });

    this.#agents.set(resolvedRepoPath, agent);
    return agent;
  }

  async getOrCreateSession(sessionId: string, repoPath: string): Promise<HarnessAgentSession> {
    const existing = this.#sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const agent = await this.ensureAgent(repoPath);
    const session = await agent.createSession({ sessionId });
    this.#sessions.set(sessionId, session);
    this.#sessionRepos.set(sessionId, repoPath);

    registerH3CodeSession({
      h3codeSessionId: sessionId,
      repoPath,
      providerId: "harness-pi",
      providerSessionRef: sessionId,
      providerSessionId: sessionId,
    });

    return session;
  }

  async streamChat(
    input: HarnessStreamChatInput,
  ): Promise<{
    result: Awaited<ReturnType<HarnessAgent["stream"]>>;
    finalize: () => void;
  }> {
    const session = await this.getOrCreateSession(input.sessionId, input.repoPath);
    const agent = await this.ensureAgent(input.repoPath);
    const prompt = extractLastUserPrompt(input.messages);

    const abortController = new AbortController();
    this.#activeStreams.set(input.sessionId, { abortController });

    const finalize = () => {
      this.#activeStreams.delete(input.sessionId);
    };

    if (input.abortSignal) {
      if (input.abortSignal.aborted) {
        abortController.abort(input.abortSignal.reason);
      } else {
        input.abortSignal.addEventListener(
          "abort",
          () => {
            abortController.abort(input.abortSignal?.reason);
          },
          { once: true },
        );
      }
    }

    const result = await agent.stream({
      session,
      prompt,
      abortSignal: abortController.signal,
    });

    return { result, finalize };
  }

  abortSession(sessionId: string): boolean {
    const active = this.#activeStreams.get(sessionId);
    if (!active) {
      return false;
    }

    active.abortController.abort();
    this.#activeStreams.delete(sessionId);
    return true;
  }

  async closeSession(sessionId: string): Promise<void> {
    this.abortSession(sessionId);

    const session = this.#sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      const resumeState = await session.stop();
      console.info(
        `[harness] stopped session ${sessionId}; resume blob bytes=${JSON.stringify(resumeState).length}`,
      );
    } catch (error) {
      console.warn(`[harness] failed to stop session ${sessionId}`, error);
    }

    await session.destroy();
    this.#sessions.delete(sessionId);
    this.#sessionRepos.delete(sessionId);
  }

  async closeAll(): Promise<void> {
    const sessionIds = [...this.#sessions.keys()];
    await Promise.all(sessionIds.map((sessionId) => this.closeSession(sessionId)));
    this.#agents.clear();
  }
}
