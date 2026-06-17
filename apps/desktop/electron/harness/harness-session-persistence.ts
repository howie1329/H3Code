import {
  getRegisteredSession,
  saveSessionUiMessages,
  updateRegisteredSessionMetadata,
  type SessionUiMessage,
} from "@h3code/agent-metadata";
import type { UIMessage } from "ai";

export function persistHarnessSessionTranscript(sessionId: string, messages: UIMessage[]) {
  saveSessionUiMessages(sessionId, messages as unknown as SessionUiMessage[]);

  const firstUserText = extractFirstUserText(messages);
  const registered = getRegisteredSession(sessionId);
  const patch: {
    modified: string;
    messageCount: number;
    firstMessage?: string;
    name?: string;
  } = {
    modified: new Date().toISOString(),
    messageCount: messages.length,
  };

  if (firstUserText) {
    patch.firstMessage = firstUserText;
  }

  if (!registered?.name && firstUserText) {
    patch.name = firstUserText.length > 80 ? `${firstUserText.slice(0, 77)}…` : firstUserText;
  }

  if (registered) {
    updateRegisteredSessionMetadata(sessionId, patch);
  }
}

function extractFirstUserText(messages: UIMessage[]): string {
  for (const message of messages) {
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

  return "";
}
