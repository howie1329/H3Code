<script lang="ts">
  import { tick } from "svelte";
  import { ArrowUp02Icon, StopCircleIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import SlashCommandMenu from "$lib/components/desktop/SlashCommandMenu.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { filterSlashCommands, getActiveSlashToken, replaceSlashToken, type SlashToken } from "$lib/slash-commands";
  import {
    PromptInput,
    PromptInputBody,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let slashToken = $state<SlashToken | null>(null);
  let highlightedIndex = $state(0);
  let dismissedTokenKey = $state<string | undefined>();

  const filteredCommands = $derived(slashToken ? filterSlashCommands(desktopState.slashCommands, slashToken.query) : []);
  const tokenKey = $derived(slashToken ? `${slashToken.start}:${slashToken.end}:${slashToken.query}` : undefined);
  const isSlashMenuOpen = $derived(Boolean(slashToken && tokenKey !== dismissedTokenKey));

  $effect(() => {
    if (highlightedIndex >= filteredCommands.length) {
      highlightedIndex = 0;
    }
  });

  function syncSlashToken() {
    if (!textareaRef) {
      slashToken = null;
      return;
    }

    const nextToken = getActiveSlashToken(desktopState.promptValue, textareaRef.selectionStart);
    const nextTokenKey = nextToken ? `${nextToken.start}:${nextToken.end}:${nextToken.query}` : undefined;
    slashToken = nextToken;

    if (!nextToken) {
      dismissedTokenKey = undefined;
      return;
    }

    if (nextTokenKey !== dismissedTokenKey) {
      void desktopState.ensureSlashCommands();
    }
  }

  function handlePromptInput() {
    dismissedTokenKey = undefined;
    syncSlashToken();
  }

  function handlePromptInteraction() {
    syncSlashToken();
  }

  function handlePromptKeydown(event: KeyboardEvent) {
    if (!isSlashMenuOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlightedIndex = filteredCommands.length === 0 ? 0 : (highlightedIndex + 1) % filteredCommands.length;
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      highlightedIndex = filteredCommands.length === 0 ? 0 : (highlightedIndex - 1 + filteredCommands.length) % filteredCommands.length;
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      dismissedTokenKey = tokenKey;
      slashToken = null;
      return;
    }

    if ((event.key === "Enter" || event.key === "Tab") && filteredCommands.length > 0 && slashToken) {
      event.preventDefault();
      insertCommand(filteredCommands[highlightedIndex] ?? filteredCommands[0], slashToken);
    }
  }

  async function insertCommand(command: PiSlashCommand, token = slashToken) {
    if (!token) {
      return;
    }

    const nextPrompt = replaceSlashToken(desktopState.promptValue, token, command);
    desktopState.promptValue = nextPrompt.value;
    slashToken = null;
    dismissedTokenKey = undefined;

    await tick();
    textareaRef?.focus();
    textareaRef?.setSelectionRange(nextPrompt.cursor, nextPrompt.cursor);
  }

  async function retryCommands() {
    await desktopState.ensureSlashCommands(true);
    syncSlashToken();
  }
</script>

<div class="relative border-t border-border/50 px-4 py-3">
  {#if isSlashMenuOpen}
    <SlashCommandMenu
      commands={filteredCommands}
      loading={desktopState.slashCommandsLoading}
      error={desktopState.slashCommandsError}
      highlightedIndex={highlightedIndex}
      unavailable={!desktopState.canUseSession}
      onSelect={(command) => insertCommand(command)}
      onHighlight={(index) => (highlightedIndex = index)}
      onRetry={retryCommands}
    />
  {/if}

  <PromptInput
    onSubmit={(message, event) => {
      slashToken = null;
      dismissedTokenKey = undefined;
      desktopState.handlePromptSubmit(message, event);
    }}
    class="flex min-h-20 flex-col rounded-lg border border-border/50 bg-background shadow-none transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-border focus-within:ring-2 focus-within:ring-ring/30"
  >
    <PromptInputBody>
      <label for="prompt" class="sr-only">Prompt</label>
      <PromptInputTextarea
        id="prompt"
        bind:ref={textareaRef}
        bind:value={desktopState.promptValue}
        class="min-h-12 px-3 py-2 text-xs leading-5 text-foreground placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-100"
        placeholder={desktopState.canUseSession ? "Ask PI to inspect this repo, implement a change, or explain the current state..." : "Select a repo and PI session first..."}
        disabled={!desktopState.canUseSession || desktopState.isBusy}
        oninput={handlePromptInput}
        onkeydown={handlePromptKeydown}
        onkeyup={handlePromptInteraction}
        onclick={handlePromptInteraction}
        onselect={handlePromptInteraction}
      />
    </PromptInputBody>
    <PromptInputToolbar class="flex h-8 min-w-0 items-center justify-between gap-3 border-t border-border/50 px-2">
      <div class="flex min-w-0 items-center gap-2 text-[11px] leading-tight text-muted-foreground">
        <span class={desktopState.isAgentRunning || desktopState.sessionState?.isStreaming ? "size-1.5 shrink-0 rounded-full bg-primary" : "size-1.5 shrink-0 rounded-full bg-muted-foreground/45"} aria-hidden="true"></span>
        <span class="shrink-0 font-medium text-foreground/80">{desktopState.sessionState?.isStreaming ? "Follow-up" : "Prompt"}</span>
        <span class="truncate">{desktopState.isSendingPrompt ? "Sending…" : "Enter send · Shift Enter newline"}</span>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-muted-foreground" onclick={() => desktopState.handleAbort()} disabled={!(desktopState.isAgentRunning || desktopState.sessionState?.isStreaming) || desktopState.isBusy}>
          <HugeiconsIcon icon={StopCircleIcon} data-icon="inline-start" />
          Abort
        </Button>
        <PromptInputSubmit class="h-7 min-w-16 gap-1 px-2.5 text-xs" disabled={!desktopState.canSubmit}>
          <HugeiconsIcon icon={ArrowUp02Icon} data-icon="inline-start" />
          {desktopState.isSendingPrompt ? "Sending" : "Send"}
        </PromptInputSubmit>
      </div>
    </PromptInputToolbar>
  </PromptInput>
</div>
