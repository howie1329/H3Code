import { Chat } from "@ai-sdk/svelte";
import type { SessionUiMessage } from "@h3code/agent-metadata";
import { DefaultChatTransport, type UIMessage } from "ai";

import { saveSessionUiMessages } from "$lib/metadata-client.js";

export type HarnessChatOptions = {
  sessionId: string;
  repoPath: string;
  api: string;
  messages?: UIMessage[];
  model?: string;
  thinkingLevel?: string;
};

export function createHarnessChat(options: HarnessChatOptions): Chat<UIMessage> {
  const transportBody: Record<string, string> = {
    repoPath: options.repoPath,
  };

  if (options.model) {
    transportBody.model = options.model;
  }

  if (options.thinkingLevel) {
    transportBody.thinkingLevel = options.thinkingLevel;
  }

  return new Chat<UIMessage>({
    id: options.sessionId,
    messages: options.messages,
    transport: new DefaultChatTransport({
      api: options.api,
      body: transportBody,
    }),
    onError: (error) => {
      console.error("[harness-chat]", error);
    },
    onFinish: ({ messages }) => {
      void saveSessionUiMessages(options.sessionId, messages as unknown as SessionUiMessage[]).catch((error) => {
        console.warn("[harness-chat] failed to mirror transcript cache", error);
      });
    },
  });
}

export async function resolveHarnessStreamUrl(): Promise<string> {
  const url = await window.h3code?.getAgentStreamUrl?.();

  if (!url) {
    throw new Error("Harness agent host is not available. Restart the desktop app.");
  }

  return url;
}

export async function abortHarnessSession(sessionId: string): Promise<void> {
  const streamUrl = await resolveHarnessStreamUrl();
  const abortUrl = streamUrl.replace(/\/api\/chat\/?$/, "/api/chat/abort");

  await fetch(abortUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId }),
  });
}
