<script lang="ts">
  import { AiBrain02Icon, AlertCircleIcon, FolderCodeIcon, TerminalIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import type { Snippet } from "svelte";

  import { desktopState, formatMessageRole, formatMessageText } from "$lib/desktop-state.svelte";
  import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
  } from "$lib/components/ai-elements/conversation/index.js";
  import {
    Message,
    MessageContent,
    type MessageRole,
  } from "$lib/components/ai-elements/message/index.js";
  import Tool from "$lib/components/ai-elements/tool/Tool.svelte";
  import ToolContent from "$lib/components/ai-elements/tool/ToolContent.svelte";
  import ToolHeader from "$lib/components/ai-elements/tool/ToolHeader.svelte";
  import type { ToolUIPartState } from "$lib/components/ai-elements/tool/tool-context.svelte.js";
  import { Button } from "$lib/components/ui/button/index.js";

  type TranscriptTextBlock = {
    kind: "text";
    id: string;
    text: string;
  };

  type TranscriptToolBlock = {
    kind: "tool";
    id: string;
    toolCallId: string;
    type: string;
    state: ToolUIPartState;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  };

  type TranscriptBlock = TranscriptTextBlock | TranscriptToolBlock;

  type TranscriptMessage = {
    id: string;
    role: MessageRole;
    roleLabel: string;
    blocks: TranscriptBlock[];
  };

  let { children }: { children?: Snippet } = $props();

  const messageRoles = new Set<MessageRole>(["user", "assistant", "system", "function", "data", "tool"]);

  const transcriptMessages = $derived(buildTranscriptMessages(desktopState.messages));

  const hasTranscriptMessages = $derived(
    Boolean(desktopState.repoPath && desktopState.sessions.length > 0 && transcriptMessages.length > 0)
  );

  function buildTranscriptMessages(messages: unknown[]): TranscriptMessage[] {
    const normalizedMessages: TranscriptMessage[] = [];
    const pendingTools = new Map<string, TranscriptToolBlock>();

    for (const [index, message] of messages.entries()) {
      const record = toRecord(message);

      if (isToolResultMessage(record)) {
        const toolResult = normalizeToolResult(record, index);
        const pendingTool = pendingTools.get(toolResult.toolCallId);

        if (pendingTool) {
          pendingTool.state = toolResult.state;
          pendingTool.output = toolResult.output;
          pendingTool.errorText = toolResult.errorText;
          continue;
        }

        normalizedMessages.push({
          id: `tool-result-${toolResult.toolCallId}-${index}`,
          role: "tool",
          roleLabel: "Tool Result",
          blocks: [toolResult],
        });
        continue;
      }

      const normalizedMessage = normalizeTranscriptMessage(message, index, pendingTools);

      if (normalizedMessage.blocks.length > 0) {
        normalizedMessages.push(normalizedMessage);
      }
    }

    return normalizedMessages;
  }

  function normalizeTranscriptMessage(
    message: unknown,
    index: number,
    pendingTools: Map<string, TranscriptToolBlock>
  ): TranscriptMessage {
    const record = toRecord(message);
    const rawId = record.id ?? record.messageId ?? record.uuid;
    const roleLabel = formatMessageRole(message);
    const blocks = normalizeMessageBlocks(record, index, pendingTools);

    if (blocks.length === 0) {
      const text = formatMessageText(message);

      if (text.trim()) {
        blocks.push({
          kind: "text",
          id: `message-${index}-text`,
          text,
        });
      }
    }

    return {
      id: typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `message-${index}`,
      role: normalizeMessageRole(roleLabel),
      roleLabel: formatRoleLabel(roleLabel),
      blocks,
    };
  }

  function normalizeMessageBlocks(
    record: Record<string, unknown>,
    messageIndex: number,
    pendingTools: Map<string, TranscriptToolBlock>
  ): TranscriptBlock[] {
    if (!Array.isArray(record.content)) {
      return [];
    }

    const blocks: TranscriptBlock[] = [];

    for (const [partIndex, part] of record.content.entries()) {
      const partRecord = toRecord(part);
      const partType = typeof partRecord.type === "string" ? partRecord.type : undefined;

      if (partType === "text" && typeof partRecord.text === "string" && partRecord.text.trim()) {
        blocks.push({
          kind: "text",
          id: `message-${messageIndex}-text-${partIndex}`,
          text: partRecord.text,
        });
        continue;
      }

      if (partType === "toolCall") {
        const toolCallId = getString(partRecord.id) ?? `message-${messageIndex}-tool-${partIndex}`;
        const toolBlock: TranscriptToolBlock = {
          kind: "tool",
          id: `tool-call-${toolCallId}`,
          toolCallId,
          type: getString(partRecord.name) ?? "tool",
          state: "input-available",
          input: partRecord.arguments,
        };

        pendingTools.set(toolCallId, toolBlock);
        blocks.push(toolBlock);
      }
    }

    return blocks;
  }

  function isToolResultMessage(record: Record<string, unknown>) {
    return record.role === "toolResult";
  }

  function normalizeToolResult(record: Record<string, unknown>, index: number): TranscriptToolBlock {
    const toolCallId = getString(record.toolCallId) ?? `tool-result-${index}`;
    const outputText = extractTextContent(record.content);
    const isError = record.isError === true;

    return {
      kind: "tool",
      id: `tool-result-${toolCallId}`,
      toolCallId,
      type: getString(record.toolName) ?? "tool",
      state: isError ? "output-error" : "output-available",
      output: isError ? undefined : outputText,
      errorText: isError ? outputText || "Tool execution failed." : undefined,
    };
  }

  function extractTextContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          const partRecord = toRecord(part);
          return typeof partRecord.text === "string" ? partRecord.text : "";
        })
        .filter(Boolean)
        .join("\n");
    }

    if (content === undefined || content === null) {
      return "";
    }

    return JSON.stringify(content, null, 2);
  }

  function formatToolValue(value: unknown) {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  function normalizeMessageRole(role: string): MessageRole {
    const normalizedRole = role.toLowerCase();

    if (messageRoles.has(normalizedRole as MessageRole)) {
      return normalizedRole as MessageRole;
    }

    if (normalizedRole.includes("user")) {
      return "user";
    }

    if (normalizedRole.includes("tool")) {
      return "tool";
    }

    if (normalizedRole.includes("system")) {
      return "system";
    }

    if (normalizedRole.includes("data")) {
      return "data";
    }

    if (normalizedRole.includes("function")) {
      return "function";
    }

    return "assistant";
  }

  function formatRoleLabel(role: string) {
    return role
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function getString(value: unknown) {
    return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
  }

  function toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  }
</script>

<section class="flex min-h-0 min-w-0 flex-col">
  <div class="flex h-10 items-center border-b border-border/50 px-4">
    <div class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <HugeiconsIcon icon={TerminalIcon} data-icon />
      <span class="truncate font-medium text-foreground">Transcript</span>
      <span class="truncate">{desktopState.selectedSession?.name ?? desktopState.selectedSession?.firstMessage ?? "No PI session selected"}</span>
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-hidden">
    {#if hasTranscriptMessages}
      <Conversation class="h-full min-h-0">
        <ConversationContent class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {#if desktopState.errorMessage}
            <div class="mx-auto mb-4 flex max-w-3xl items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} data-icon />
              <span>{desktopState.errorMessage}</span>
            </div>
          {/if}

          <div class="mx-auto flex max-w-3xl flex-col gap-4">
            {#each transcriptMessages as message (message.id)}
              <Message from={message.role} class="max-w-full border-b border-border/50 pb-4 last:border-b-0">
                <div class={message.role === "user" ? "ml-auto text-[11px] font-medium uppercase tracking-wide text-muted-foreground" : "text-[11px] font-medium uppercase tracking-wide text-muted-foreground"}>
                  {message.roleLabel}
                </div>
                <MessageContent class={message.role === "user" ? "max-w-[min(42rem,85%)]" : "w-full max-w-full overflow-visible"}>
                  {#each message.blocks as block (block.id)}
                    {#if block.kind === "text"}
                      <pre class="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">{block.text}</pre>
                    {:else}
                      <Tool class="mt-1 mb-0 rounded-md border-border/50 bg-background">
                        <ToolHeader type={block.type} state={block.state} class="px-3 py-2 text-xs" />
                        <ToolContent class="border-t border-border/50">
                          {#if block.input !== undefined}
                            <div class="space-y-2 p-3">
                              <h4 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Parameters</h4>
                              <pre class="overflow-x-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-5 text-foreground">{formatToolValue(block.input)}</pre>
                            </div>
                          {/if}
                          {#if block.errorText || block.output}
                            <div class="space-y-2 p-3 pt-0">
                              <h4 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{block.errorText ? "Error" : "Result"}</h4>
                              <pre class={block.errorText ? "overflow-x-auto rounded-md bg-destructive/10 p-3 font-mono text-xs leading-5 text-destructive" : "overflow-x-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-5 text-foreground"}>{block.errorText ?? formatToolValue(block.output)}</pre>
                            </div>
                          {/if}
                        </ToolContent>
                      </Tool>
                    {/if}
                  {/each}
                </MessageContent>
              </Message>
            {/each}
          </div>
        </ConversationContent>
        <ConversationScrollButton class="size-8 border-border/50 bg-background text-muted-foreground shadow-none hover:bg-accent hover:text-foreground" />
      </Conversation>
    {:else}
      <div class="h-full overflow-auto px-6 py-5">
        {#if desktopState.errorMessage}
          <div class="mb-4 flex items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} data-icon />
            <span>{desktopState.errorMessage}</span>
          </div>
        {/if}

        {#if !desktopState.repoPath}
          <div class="flex min-h-full items-center justify-center px-6 py-10">
            <div class="grid w-full max-w-sm justify-items-center text-center">
              <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                <HugeiconsIcon icon={desktopState.repos.length > 0 ? AiBrain02Icon : FolderCodeIcon} data-icon />
              </div>
              {#if desktopState.repos.length > 0}
                <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No session selected</p>
                <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Choose a session from the sidebar.</h2>
                <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Expand a repository, then open an existing session or create a new one.</p>
              {:else}
                <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No repository selected</p>
                <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Choose a repo to start.</h2>
                <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">H3Code will load PI sessions from the selected folder.</p>
                <Button class="mt-4" onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
                  <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
                  Select repo
                </Button>
              {/if}
            </div>
          </div>
        {:else if desktopState.sessions.length === 0}
          <div class="flex min-h-full items-center justify-center px-6 py-10">
            <div class="grid w-full max-w-sm justify-items-center text-center">
              <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                <HugeiconsIcon icon={AiBrain02Icon} data-icon />
              </div>
              <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No sessions</p>
              <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Create a PI session.</h2>
              <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Start a session for this repository when you are ready.</p>
              <Button class="mt-4" onclick={() => desktopState.handleNewSession()} disabled={desktopState.piStatus.state !== "connected" || desktopState.isBusy}>
                <HugeiconsIcon icon={AiBrain02Icon} data-icon="inline-start" />
                New session
              </Button>
            </div>
          </div>
        {:else if desktopState.messages.length === 0}
          <div class="flex min-h-full items-center justify-center px-6 py-10">
            <div class="grid w-full max-w-sm justify-items-center text-center">
              <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                <HugeiconsIcon icon={TerminalIcon} data-icon />
              </div>
              <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Empty transcript</p>
              <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Send a prompt to PI.</h2>
              <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Use the composer below to start this session.</p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {@render children?.()}
</section>
