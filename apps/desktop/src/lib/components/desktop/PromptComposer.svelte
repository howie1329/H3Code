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
  const showAbort = $derived(desktopState.isAgentRunning || desktopState.sessionState?.isStreaming);
  const isRunning = $derived(desktopState.isAgentRunning || desktopState.sessionState?.isStreaming);
  const showSlashHint = $derived(
    desktopState.canUseSession && desktopState.slashCommands.length > 0 && !desktopState.slashCommandsLoading
  );

  const promptPlaceholder = $derived.by(() => {
    if (desktopState.canUseSession) {
      return "Ask PI about this repo…";
    }

    if (!desktopState.repoPath) {
      return "Select a repo and session…";
    }

    if (desktopState.piStatus.state !== "connected") {
      return "Connect PI to send prompts…";
    }

    return "Select a repo and session…";
  });

  const composerMeta = $derived.by(() => {
    if (desktopState.isSendingPrompt) {
      return { showDot: true, dotClass: "size-1.5 shrink-0 animate-pulse rounded-full bg-primary", text: "Sending…" };
    }

    if (isRunning) {
      return {
        showDot: true,
        dotClass: "size-1.5 shrink-0 rounded-full bg-primary",
        text: "Pi is running · follow-ups queue automatically",
      };
    }

    if (!desktopState.canUseSession) {
      if (!desktopState.repoPath) {
        return { showDot: false, dotClass: "", text: "Select a repository to send prompts" };
      }

      if (desktopState.piStatus.state !== "connected") {
        return { showDot: false, dotClass: "", text: "Connect PI to send prompts" };
      }

      if (!desktopState.selectedSessionPath && !desktopState.sessionState?.sessionFile) {
        return { showDot: false, dotClass: "", text: "Select a session to send prompts" };
      }
    }

    if (desktopState.isBusy) {
      return { showDot: false, dotClass: "", text: "Busy…" };
    }

    const base = "Enter to send · Shift+Enter for newline";
    return {
      showDot: false,
      dotClass: "",
      text: showSlashHint ? `${base} · / for commands` : base,
    };
  });

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
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const command = filteredCommands[highlightedIndex];

      if (command) {
        void insertCommand(command);
      }
    }
  }

  async function insertCommand(command: PiSlashCommand) {
    if (!textareaRef || !slashToken) {
      return;
    }

    const nextPrompt = replaceSlashToken(desktopState.promptValue, slashToken, command);
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

<div class="border-t border-border/50 px-6 py-3">
  <div class="relative mx-auto max-w-3xl">
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
      class="flex w-full flex-col overflow-hidden rounded-lg border border-border/50 bg-background p-2 shadow-none transition-[box-shadow,ring] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:ring-2 focus-within:ring-ring motion-reduce:transition-none"
    >
      <PromptInputBody class="min-w-0">
        <label for="prompt" class="sr-only">Prompt</label>
        <PromptInputTextarea
          id="prompt"
          bind:ref={textareaRef}
          bind:value={desktopState.promptValue}
          class="min-h-10 px-1 py-1 text-xs leading-snug text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={promptPlaceholder}
          disabled={!desktopState.canUseSession || desktopState.isBusy}
          oninput={handlePromptInput}
          onkeydown={handlePromptKeydown}
          onkeyup={handlePromptInteraction}
          onclick={handlePromptInteraction}
          onselect={handlePromptInteraction}
        />
      </PromptInputBody>
      <PromptInputToolbar class="flex h-8 min-w-0 items-center justify-between gap-3 px-1 pt-2">
        <div class="flex min-w-0 items-center gap-2 text-[11px] leading-tight text-muted-foreground">
          {#if composerMeta.showDot}
            <span class={composerMeta.dotClass} aria-hidden="true"></span>
          {/if}
          <span class="truncate">{composerMeta.text}</span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          {#if showAbort}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Abort run"
              title="Abort run"
              onclick={() => desktopState.handleAbort()}
              disabled={desktopState.isBusy}
            >
              <HugeiconsIcon icon={StopCircleIcon} data-icon />
            </Button>
          {/if}
          <PromptInputSubmit
            variant="default"
            size="icon"
            data-prompt-input-submit
            class="size-8 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            title="Send prompt"
            disabled={!desktopState.canSubmit}
          >
            <HugeiconsIcon icon={ArrowUp02Icon} data-icon />
          </PromptInputSubmit>
        </div>
      </PromptInputToolbar>
    </PromptInput>
  </div>
</div>
