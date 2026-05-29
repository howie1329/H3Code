export type ToolUIPartState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export type TranscriptTextBlock = {
  kind: "text";
  id: string;
  text: string;
};

export type TranscriptThinkingBlock = {
  kind: "thinking";
  id: string;
  text: string;
};

export type TranscriptToolBlock = {
  kind: "tool";
  id: string;
  toolCallId: string;
  type: string;
  state: ToolUIPartState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export type TranscriptBlock =
  | TranscriptTextBlock
  | TranscriptThinkingBlock
  | TranscriptToolBlock
  | { kind: "metadata"; id: string; title: string; entries: unknown[] };

export type TranscriptWorkBlock = {
  kind: "work";
  id: string;
  thinking: TranscriptThinkingBlock[];
  tools: TranscriptToolBlock[];
};

export type RenderBlock = TranscriptTextBlock | TranscriptWorkBlock;

export function groupBlocksForRender(blocks: TranscriptBlock[]): RenderBlock[] {
  const grouped: RenderBlock[] = [];
  let pendingThinking: TranscriptThinkingBlock[] = [];
  let pendingTools: TranscriptToolBlock[] = [];

  function flushWork() {
    if (pendingThinking.length === 0 && pendingTools.length === 0) {
      return;
    }

    const anchor = pendingThinking[0] ?? pendingTools[0];
    grouped.push({
      kind: "work",
      id: `work-${anchor.id}`,
      thinking: pendingThinking,
      tools: pendingTools,
    });
    pendingThinking = [];
    pendingTools = [];
  }

  for (const block of blocks) {
    if (block.kind === "thinking") {
      pendingThinking.push(block);
      continue;
    }

    if (block.kind === "tool") {
      pendingTools.push(block);
      continue;
    }

    flushWork();

    if (block.kind === "metadata") {
      continue;
    }

    grouped.push(block);
  }

  flushWork();
  return grouped;
}

export function extractStreamingThinkingText(message: unknown): string {
  const record = message && typeof message === "object" ? (message as Record<string, unknown>) : {};
  if (!Array.isArray(record.content)) {
    return "";
  }

  return record.content
    .map((part) => {
      const partRecord = part && typeof part === "object" ? (part as Record<string, unknown>) : {};
      if (partRecord.type === "thinking" && typeof partRecord.thinking === "string") {
        return partRecord.thinking;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}
