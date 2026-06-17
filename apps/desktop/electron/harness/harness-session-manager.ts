import type { HarnessAgentSession } from "@ai-sdk/harness/agent";
import { HarnessAgent } from "@ai-sdk/harness/agent";
import {
  createDesktopPiAgent,
  resolveDesktopHarnessConfig,
  type DesktopAuthConfig,
  type DesktopHarnessConfig,
} from "@h3code/agent-provider-pi/harness";
import {
  getHarnessResumeBlob,
  registerH3CodeSession,
  saveHarnessResumeBlob,
} from "@h3code/agent-metadata";
import type { UIMessage } from "ai";

type ActiveStream = {
  abortController: AbortController;
};

export type HarnessStreamChatInput = {
  sessionId: string;
  repoPath: string;
  messages: UIMessage[];
  model?: string;
  thinkingLevel?: DesktopHarnessConfig["thinkingLevel"];
  abortSignal?: AbortSignal;
};

export type HarnessSessionManagerOptions = {
  authConfig?: DesktopAuthConfig;
};

type ResolvedAgentConfig = {
  model: string;
  thinkingLevel: DesktopHarnessConfig["thinkingLevel"];
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

function agentCacheKey(repoPath: string, config: ResolvedAgentConfig): string {
  return `${repoPath}\0${config.model}\0${config.thinkingLevel}`;
}

function resolveAgentConfig(
  authConfig: DesktopAuthConfig | undefined,
  overrides?: Pick<HarnessStreamChatInput, "model" | "thinkingLevel">,
): ResolvedAgentConfig {
  const harnessConfig = resolveDesktopHarnessConfig({
    ...authConfig,
    model: overrides?.model,
    thinkingLevel: overrides?.thinkingLevel,
  });

  return {
    model: harnessConfig.model,
    thinkingLevel: harnessConfig.thinkingLevel,
  };
}

const THINKING_LEVELS = new Set<DesktopHarnessConfig["thinkingLevel"]>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

export function normalizeThinkingLevel(
  value: string | undefined,
): DesktopHarnessConfig["thinkingLevel"] | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase() as DesktopHarnessConfig["thinkingLevel"];
  return THINKING_LEVELS.has(normalized) ? normalized : undefined;
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

  async ensureAgent(repoPath: string, overrides?: Pick<HarnessStreamChatInput, "model" | "thinkingLevel">): Promise<HarnessAgent> {
    const config = resolveAgentConfig(this.#authConfig, overrides);
    const cacheKey = agentCacheKey(repoPath, config);
    const existing = this.#agents.get(cacheKey);
    if (existing) {
      return existing;
    }

    const harnessConfig = resolveDesktopHarnessConfig({
      ...this.#authConfig,
      model: config.model,
      thinkingLevel: config.thinkingLevel,
    });

    const agent = await createDesktopPiAgent({
      repoPath,
      auth: harnessConfig.auth,
      model: harnessConfig.model,
      thinkingLevel: harnessConfig.thinkingLevel,
    });

    this.#agents.set(cacheKey, agent);
    return agent;
  }

  async getOrCreateSession(
    sessionId: string,
    repoPath: string,
    overrides?: Pick<HarnessStreamChatInput, "model" | "thinkingLevel">,
  ): Promise<HarnessAgentSession> {
    const existing = this.#sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const agent = await this.ensureAgent(repoPath, overrides);
    const resumeFrom = getHarnessResumeBlob(sessionId);

    let session: HarnessAgentSession;

    if (resumeFrom !== undefined) {
      try {
        session = await agent.createSession({ sessionId, resumeFrom: resumeFrom as never });
      } catch (error) {
        console.warn(`[harness] resume failed for ${sessionId}, starting fresh`, error);
        session = await agent.createSession({ sessionId });
      }
    } else {
      session = await agent.createSession({ sessionId });
    }

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
    const overrides = { model: input.model, thinkingLevel: input.thinkingLevel };
    const session = await this.getOrCreateSession(input.sessionId, input.repoPath, overrides);
    const agent = await this.ensureAgent(input.repoPath, overrides);
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
      saveHarnessResumeBlob(sessionId, resumeState);
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
