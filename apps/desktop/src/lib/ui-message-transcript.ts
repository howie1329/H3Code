import type { MessageRole } from "$lib/components/ai-elements/message/index.js";
import type { ToolUIPartState } from "$lib/components/ai-elements/tool/tool-context.svelte.js";
import type { TranscriptMessage, TranscriptViewModel } from "$lib/components/desktop/transcript-normalize.js";
import type { UIMessage } from "ai";

function mapToolState(state: string | undefined): ToolUIPartState {
  switch (state) {
    case "input-streaming":
    case "input-available":
    case "output-available":
    case "output-error":
      return state;
    default:
      return "input-available";
  }
}

function uiMessageToTranscriptMessage(message: UIMessage): TranscriptMessage {
  const blocks: TranscriptMessage["blocks"] = [];

  for (const [index, part] of message.parts.entries()) {
    const partId = `${message.id}-${index}`;

    if (part.type === "text") {
      if (part.text.trim()) {
        blocks.push({ kind: "text", id: partId, text: part.text });
      }
      continue;
    }

    if (part.type === "reasoning") {
      const text = "text" in part && typeof part.text === "string" ? part.text : "";
      if (text.trim()) {
        blocks.push({ kind: "thinking", id: partId, text });
      }
      continue;
    }

    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const toolName =
        part.type === "dynamic-tool"
          ? part.toolName
          : part.type.slice("tool-".length);
      const state = "state" in part ? mapToolState(String(part.state)) : "input-available";

      blocks.push({
        kind: "tool",
        id: partId,
        toolCallId: "toolCallId" in part && typeof part.toolCallId === "string" ? part.toolCallId : partId,
        type: toolName,
        state,
        input: "input" in part ? part.input : undefined,
        output: "output" in part ? part.output : undefined,
        errorText: "errorText" in part && typeof part.errorText === "string" ? part.errorText : undefined,
      });
    }
  }

  const role = (message.role ?? "assistant") as MessageRole;

  return {
    id: message.id,
    role,
    roleLabel: role,
    blocks,
  };
}

export function buildTranscriptViewModelFromUiMessages(messages: UIMessage[]): TranscriptViewModel {
  return {
    messages: messages
      .map(uiMessageToTranscriptMessage)
      .filter((message) => message.blocks.length > 0),
    sessionMetadata: [],
  };
}

export function extractStreamingThinkingFromUiMessages(messages: UIMessage[]): string {
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  if (!lastAssistant) {
    return "";
  }

  return lastAssistant.parts
    .filter((part): part is Extract<typeof part, { type: "reasoning" }> => part.type === "reasoning")
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n\n");
}
