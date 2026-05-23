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
  import { Button } from "$lib/components/ui/button/index.js";

  type TranscriptMessage = {
    id: string;
    role: MessageRole;
    roleLabel: string;
    text: string;
  };

  let { children }: { children?: Snippet } = $props();

  const messageRoles = new Set<MessageRole>(["user", "assistant", "system", "function", "data", "tool"]);

  const transcriptMessages = $derived(
    desktopState.messages.map((message, index) => normalizeTranscriptMessage(message, index))
  );

  const hasTranscriptMessages = $derived(
    Boolean(desktopState.repoPath && desktopState.sessions.length > 0 && transcriptMessages.length > 0)
  );

  function normalizeTranscriptMessage(message: unknown, index: number): TranscriptMessage {
    const record = toRecord(message);
    const rawId = record.id ?? record.messageId ?? record.uuid;
    const roleLabel = formatMessageRole(message);

    return {
      id: typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `message-${index}`,
      role: normalizeMessageRole(roleLabel),
      roleLabel: formatRoleLabel(roleLabel),
      text: formatMessageText(message),
    };
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
                  <pre class="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">{message.text}</pre>
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
                <HugeiconsIcon icon={FolderCodeIcon} data-icon />
              </div>
              <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No repository selected</p>
              <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Choose a repo to start.</h2>
              <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">H3Code will load PI sessions from the selected folder.</p>
              <Button class="mt-4" onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
                <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
                Select repo
              </Button>
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
