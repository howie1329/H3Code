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
  import TranscriptMetadataBlock from "$lib/components/desktop/TranscriptMetadataBlock.svelte";
  import { isMetadataRole, parseMetadataText } from "$lib/components/desktop/transcript-metadata.js";
  import {
    Message,
    MessageContent,
    MessageResponse,
    type MessageRole,
  } from "$lib/components/ai-elements/message/index.js";
  import Tool from "$lib/components/ai-elements/tool/Tool.svelte";
  import ToolContent from "$lib/components/ai-elements/tool/ToolContent.svelte";
  import ToolHeader from "$lib/components/ai-elements/tool/ToolHeader.svelte";
  import type { ToolUIPartState } from "$lib/components/ai-elements/tool/tool-context.svelte.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
  } from "$lib/components/ui/empty/index.js";
  import { Kbd } from "$lib/components/ui/kbd/index.js";

  type TranscriptTextBlock = {
    kind: "text";
    id: string;
    text: string;
  };

  type TranscriptThinkingBlock = {
    kind: "thinking";
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

  type TranscriptMetadataBlockModel = {
    kind: "metadata";
    id: string;
    title: string;
    entries: { label: string; value: string }[];
  };

  type TranscriptBlock = TranscriptTextBlock | TranscriptThinkingBlock | TranscriptToolBlock | TranscriptMetadataBlockModel;

  type TranscriptMessage = {
    id: string;
    role: MessageRole;
    roleLabel: string;
    blocks: TranscriptBlock[];
  };

  let { children }: { children?: Snippet } = $props();

  const messageRoles = new Set<MessageRole>(["user", "assistant", "system", "function", "data", "tool"]);

  const transcriptMessages = $derived(buildTranscriptMessages(desktopState.transcriptMessages));
  const isThinking = $derived(
    Boolean((desktopState.isAgentRunning || desktopState.sessionState?.isStreaming) && !desktopState.streamingMessage)
  );

  const hasTranscriptMessages = $derived(
    Boolean(desktopState.repoPath && desktopState.sessions.length > 0 && (transcriptMessages.length > 0 || isThinking))
  );
  const shortcutModifier = $derived(desktopState.platform === "darwin" ? "⌘" : "Ctrl");

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
        if (isMetadataRole(roleLabel)) {
          blocks.push({
            kind: "metadata",
            id: `message-${index}-metadata`,
            title: formatRoleLabel(roleLabel),
            entries: parseMetadataText(text),
          });
        } else {
          blocks.push({
            kind: "text",
            id: `message-${index}-text`,
            text,
          });
        }
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

      if (partType === "thinking" && typeof partRecord.thinking === "string" && partRecord.thinking.trim()) {
        blocks.push({
          kind: "thinking",
          id: `message-${messageIndex}-thinking-${partIndex}`,
          text: partRecord.thinking,
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
    return record.role === "toolResult" || record.role === "toolExecution";
  }

  function normalizeToolResult(record: Record<string, unknown>, index: number): TranscriptToolBlock {
    const toolCallId = getString(record.toolCallId) ?? `tool-result-${index}`;
    const outputText = extractTextContent(record.content);
    const isError = record.isError === true;
    const state = normalizeToolState(record.state, isError);

    return {
      kind: "tool",
      id: `tool-result-${toolCallId}`,
      toolCallId,
      type: getString(record.toolName) ?? "tool",
      state,
      input: record.args,
      output: isError ? undefined : outputText,
      errorText: isError ? outputText || "Tool execution failed." : undefined,
    };
  }

  function normalizeToolState(value: unknown, isError: boolean): ToolUIPartState {
    if (value === "input-streaming" || value === "input-available" || value === "output-available" || value === "output-error") {
      return value;
    }

    return isError ? "output-error" : "output-available";
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
      .replace(/([a-z])([A-Z])/g, "$1 $2")
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

<section class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Workspace transcript">
  <div class="min-h-0 flex-1 overflow-hidden">
    {#if hasTranscriptMessages}
      <Conversation class="h-full min-h-0">
        <ConversationContent class="min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-24">
          {#if desktopState.errorMessage}
            <div
              class="mx-auto mb-4 flex max-w-3xl items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive"
              role="alert"
              aria-live="assertive"
            >
              <HugeiconsIcon icon={AlertCircleIcon} data-icon />
              <span>{desktopState.errorMessage}</span>
            </div>
          {/if}

          <div class="mx-auto flex max-w-3xl flex-col gap-6">
            {#each transcriptMessages as message (message.id)}
              <Message from={message.role} class="max-w-full">
                <div class={message.role === "user" ? "ml-auto text-[11px] font-medium uppercase tracking-wide text-muted-foreground" : "text-[11px] font-medium uppercase tracking-wide text-muted-foreground"}>
                  {message.roleLabel}
                </div>
                <MessageContent class={message.role === "user" ? "max-w-[min(42rem,85%)]" : "w-full max-w-full overflow-visible"}>
                  {#each message.blocks as block (block.id)}
                    {#if block.kind === "text"}
                      {#if message.role === "user"}
                        <p class="whitespace-pre-wrap break-words text-sm leading-6">{block.text}</p>
                      {:else}
                        <MessageResponse content={block.text} />
                      {/if}
                    {:else if block.kind === "metadata"}
                      <TranscriptMetadataBlock title={block.title} entries={block.entries} />
                    {:else if block.kind === "thinking"}
                      <div class="space-y-1 py-1 text-xs leading-5 text-muted-foreground">
                        <div class="text-[10px] font-medium uppercase tracking-wide">Thinking</div>
                        <p class="whitespace-pre-wrap break-words">{block.text}</p>
                      </div>
                    {:else}
                      <Tool class="mb-0 border-0 border-t border-border/50 bg-transparent shadow-none">
                        <ToolHeader type={block.type} state={block.state} class="px-0 py-2 text-xs" />
                        <ToolContent class="border-t border-border/50">
                          {#if block.input !== undefined}
                            <div class="space-y-2 py-2">
                              <h4 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Parameters</h4>
                              <pre class="overflow-x-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-5 text-foreground">{formatToolValue(block.input)}</pre>
                            </div>
                          {/if}
                          {#if block.errorText || block.output}
                            <div class="space-y-2 py-2">
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

            {#if isThinking}
              <Message from="assistant" class="max-w-full">
                <div class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Assistant</div>
                <MessageContent class="w-full max-w-full overflow-visible">
                  <div class="flex items-center gap-2 text-sm leading-6 text-muted-foreground" aria-live="polite" aria-busy="true">
                    <span class="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true"></span>
                    <span>Pi is thinking…</span>
                  </div>
                </MessageContent>
              </Message>
            {/if}
          </div>
        </ConversationContent>
        <ConversationScrollButton class="size-8 border-border/50 bg-background text-muted-foreground shadow-none hover:bg-accent hover:text-foreground" />
      </Conversation>
    {:else}
      <div class="h-full overflow-auto px-6 py-5">
        {#if desktopState.errorMessage}
          <div class="mb-4 flex items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive" role="alert" aria-live="assertive">
            <HugeiconsIcon icon={AlertCircleIcon} data-icon />
            <span>{desktopState.errorMessage}</span>
          </div>
        {/if}

        <div class="flex min-h-full items-center justify-center px-6 py-10">
          {#if !desktopState.repoPath && desktopState.repos.length === 0}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={FolderCodeIcon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No repository selected</p>
                <EmptyTitle>Choose a repo to start.</EmptyTitle>
                <EmptyDescription>H3Code will load PI sessions from the selected folder.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
                  <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
                  Select repo
                </Button>
              </EmptyContent>
            </Empty>
          {:else if !desktopState.repoPath}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={AiBrain02Icon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No session selected</p>
                <EmptyTitle>Choose a session from the sidebar.</EmptyTitle>
                <EmptyDescription>Expand a repository, then open an existing session or create a new one.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          {:else if desktopState.piStatus.state !== "connected"}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={TerminalIcon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PI disconnected</p>
                <EmptyTitle>Connect PI for this repo.</EmptyTitle>
                <EmptyDescription>Start PI RPC before creating sessions or sending prompts.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onclick={() => desktopState.repoPath && desktopState.connectRepo(desktopState.repoPath)} disabled={desktopState.isBusy}>
                  Connect PI
                </Button>
              </EmptyContent>
            </Empty>
          {:else if desktopState.sessions.length === 0}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={AiBrain02Icon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No sessions</p>
                <EmptyTitle>Create a PI session.</EmptyTitle>
                <EmptyDescription>Start a session for this repository when you are ready.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onclick={() => desktopState.handleNewSession()} disabled={desktopState.isBusy}>
                  <HugeiconsIcon icon={AiBrain02Icon} data-icon="inline-start" />
                  New session
                </Button>
              </EmptyContent>
            </Empty>
          {:else if desktopState.messages.length === 0}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={TerminalIcon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Empty transcript</p>
                <EmptyTitle>Ready for a prompt.</EmptyTitle>
                <EmptyDescription>Ask PI about this repository from the composer below.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div class="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <span class="inline-flex items-center gap-1"><Kbd>Enter</Kbd> send</span>
                  <span class="inline-flex items-center gap-1"><Kbd>/</Kbd> commands</span>
                  <span class="inline-flex items-center gap-1"><Kbd>{shortcutModifier}</Kbd><Kbd>L</Kbd> focus composer</span>
                </div>
              </EmptyContent>
            </Empty>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="shrink-0">
    {@render children?.()}
  </div>
</section>
