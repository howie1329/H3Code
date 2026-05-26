<script lang="ts">
  import { tick } from "svelte";
  import { ArrowUp02Icon, StopCircleIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import ComposerSessionMenu from "$lib/components/desktop/ComposerSessionMenu.svelte";
  import SlashCommandMenu from "$lib/components/desktop/SlashCommandMenu.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { isSameModel, modelSupportsThinking, normalizeThinkingLevel, PI_THINKING_LEVELS } from "$lib/pi-model.js";
  import { filterSlashCommands, getActiveSlashToken, replaceSlashToken, type SlashToken } from "$lib/slash-commands";
  import {
    PromptInput,
    PromptInputBody,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Kbd } from "$lib/components/ui/kbd/index.js";

  type ComposerMenu = "none" | "slash" | "session";

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let sessionAnchor = $state<HTMLElement | null>(null);
  let slashToken = $state<SlashToken | null>(null);
  let dismissedTokenKey = $state<string | undefined>();
  let activeMenu = $state<ComposerMenu>("none");
  let slashHighlightedIndex = $state(0);
  let modelHighlightedIndex = $state(0);
  let thinkingHighlightedIndex = $state(0);
  let sessionMenuLeft = $state(0);

  const filteredCommands = $derived(slashToken ? filterSlashCommands(desktopState.slashCommands, slashToken.query) : []);
  const tokenKey = $derived(slashToken ? `${slashToken.start}:${slashToken.end}:${slashToken.query}` : undefined);
  const isSlashMenuOpen = $derived(activeMenu === "slash" && Boolean(slashToken && tokenKey !== dismissedTokenKey));
  const showAbort = $derived(desktopState.isAgentRunning || desktopState.sessionState?.isStreaming);
  const isRunning = $derived(desktopState.isAgentRunning || desktopState.sessionState?.isStreaming);
  const showSlashHint = $derived(
    desktopState.canUseSession && desktopState.slashCommands.length > 0 && !desktopState.slashCommandsLoading
  );
  const selectorsDisabled = $derived(!desktopState.canChangeSessionSettings || !desktopState.canUseSession);
  const currentModel = $derived(desktopState.sessionState?.model);
  const flatModels = $derived(desktopState.availableModels);
  const currentThinkingLevel = $derived(normalizeThinkingLevel(desktopState.sessionState?.thinkingLevel));
  const showThinkingSelector = $derived(modelSupportsThinking(currentModel));

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
        dotClass: "size-1.5 shrink-0 animate-pulse rounded-full bg-primary",
        text: "Pi is working…",
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

    return { showDot: false, dotClass: "", text: "" };
  });

  $effect(() => {
    if (slashHighlightedIndex >= filteredCommands.length) {
      slashHighlightedIndex = 0;
    }
  });

  $effect(() => {
    if (modelHighlightedIndex >= flatModels.length) {
      modelHighlightedIndex = 0;
    }
  });

  $effect(() => {
    if (thinkingHighlightedIndex >= PI_THINKING_LEVELS.length) {
      thinkingHighlightedIndex = 0;
    }
  });

  $effect(() => {
    if (activeMenu === "session") {
      updateMenuPosition(sessionAnchor, (left) => (sessionMenuLeft = left));
    }
  });

  $effect(() => {
    if (desktopState.canUseSession) {
      void desktopState.ensureAvailableModels();
    }
  });

  $effect(() => {
    function handleFocusComposer() {
      textareaRef?.focus();
    }

    window.addEventListener("h3code:focus-composer", handleFocusComposer);

    return () => {
      window.removeEventListener("h3code:focus-composer", handleFocusComposer);
    };
  });

  function updateMenuPosition(anchor: HTMLElement | null, setLeft: (left: number) => void) {
    if (!anchor || !wrapperRef) {
      return;
    }

    const wrapperRect = wrapperRef.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    setLeft(anchorRect.left - wrapperRect.left);
  }

  function closeMenus() {
    activeMenu = "none";
  }

  function openMenu(menu: ComposerMenu) {
    if (menu === "slash") {
      activeMenu = "slash";
      return;
    }

    if (menu === "session" && !selectorsDisabled) {
      activeMenu = "session";
      slashToken = null;
      dismissedTokenKey = undefined;
      const currentIndex = flatModels.findIndex((entry) => isSameModel(entry, currentModel));
      modelHighlightedIndex = currentIndex >= 0 ? currentIndex : 0;
      thinkingHighlightedIndex = PI_THINKING_LEVELS.indexOf(currentThinkingLevel);
      void desktopState.ensureAvailableModels();
    }
  }

  function toggleSessionMenu() {
    if (activeMenu === "session") {
      closeMenus();
      return;
    }

    openMenu("session");
  }

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

      if (activeMenu === "slash") {
        activeMenu = "none";
      }

      return;
    }

    if (nextTokenKey !== dismissedTokenKey) {
      void desktopState.ensureSlashCommands();
      activeMenu = "slash";
    }
  }

  function handlePromptInput() {
    dismissedTokenKey = undefined;
    syncSlashToken();
  }

  function handlePromptInteraction() {
    syncSlashToken();
  }

  function handleWindowClick(event: MouseEvent) {
    if (activeMenu === "none" || !wrapperRef) {
      return;
    }

    const target = event.target;

    if (target instanceof Node && wrapperRef.contains(target)) {
      return;
    }

    closeMenus();
  }

  function handlePromptKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && activeMenu !== "none") {
      event.preventDefault();

      if (activeMenu === "slash") {
        dismissedTokenKey = tokenKey;
      }

      closeMenus();
      return;
    }

    if (activeMenu === "session" && flatModels.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        modelHighlightedIndex = (modelHighlightedIndex + 1) % flatModels.length;
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        modelHighlightedIndex = (modelHighlightedIndex - 1 + flatModels.length) % flatModels.length;
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const model = flatModels[modelHighlightedIndex];

        if (model) {
          void selectModel(model);
        }

        return;
      }
    }

    if (isRunning && event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      const text = desktopState.promptValue.trim();

      if (text && desktopState.canSubmit) {
        void desktopState.handleSteerSubmit(text);
      }

      return;
    }

    if (!isSlashMenuOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      slashHighlightedIndex = filteredCommands.length === 0 ? 0 : (slashHighlightedIndex + 1) % filteredCommands.length;
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      slashHighlightedIndex =
        filteredCommands.length === 0 ? 0 : (slashHighlightedIndex - 1 + filteredCommands.length) % filteredCommands.length;
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const command = filteredCommands[slashHighlightedIndex];

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
    closeMenus();

    await tick();
    textareaRef?.focus();
    textareaRef?.setSelectionRange(nextPrompt.cursor, nextPrompt.cursor);
  }

  async function retryCommands() {
    await desktopState.ensureSlashCommands(true);
    syncSlashToken();
  }

  async function retryModels() {
    await desktopState.ensureAvailableModels(true);
  }

  async function selectModel(model: PiModel) {
    closeMenus();
    await desktopState.setModel(model.provider, model.id);
  }

  async function selectThinkingLevel(level: PiThinkingLevel) {
    closeMenus();
    await desktopState.setThinkingLevel(level);
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="border-t border-border/50 px-6 py-3">
  <div bind:this={wrapperRef} class="relative mx-auto max-w-3xl">
    {#if isSlashMenuOpen}
      <SlashCommandMenu
        commands={filteredCommands}
        loading={desktopState.slashCommandsLoading}
        error={desktopState.slashCommandsError}
        highlightedIndex={slashHighlightedIndex}
        unavailable={!desktopState.canUseSession}
        onSelect={(command) => insertCommand(command)}
        onHighlight={(index) => (slashHighlightedIndex = index)}
        onRetry={retryCommands}
      />
    {/if}

    <PromptInput
      onSubmit={(message, event) => {
        slashToken = null;
        dismissedTokenKey = undefined;
        closeMenus();
        desktopState.handlePromptSubmit(message, event);
      }}
      class="flex w-full flex-col rounded-lg border border-border/50 bg-background shadow-none transition-[box-shadow,ring] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:ring-2 focus-within:ring-ring motion-reduce:transition-none"
    >
      <PromptInputBody class="min-w-0 overflow-y-auto max-h-48">
        <label for="prompt" class="sr-only">Prompt</label>
        <PromptInputTextarea
          id="prompt"
          bind:ref={textareaRef}
          bind:value={desktopState.promptValue}
          class="min-h-12 border-none px-3 pt-3 pb-2 text-xs leading-snug text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={promptPlaceholder}
          disabled={!desktopState.canUseSession || desktopState.isBusy}
          oninput={handlePromptInput}
          onkeydown={handlePromptKeydown}
          onkeyup={handlePromptInteraction}
          onclick={(event) => {
            event.stopPropagation();
            handlePromptInteraction();
          }}
          onselect={handlePromptInteraction}
        />
      </PromptInputBody>
      <PromptInputToolbar class="flex h-10 min-w-0 items-center justify-between gap-3 border-t border-border/50 px-3 py-1.5">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <ComposerSessionMenu
            open={activeMenu === "session"}
            disabled={selectorsDisabled}
            menuLeft={sessionMenuLeft}
            bind:anchor={sessionAnchor}
            {modelHighlightedIndex}
            {thinkingHighlightedIndex}
            onToggle={toggleSessionMenu}
            onSelectModel={(model) => selectModel(model)}
            onSelectThinkingLevel={(level) => selectThinkingLevel(level)}
            onHighlightModel={(index) => (modelHighlightedIndex = index)}
            onHighlightThinking={(index) => (thinkingHighlightedIndex = index)}
            onRetryModels={retryModels}
          />
          <div class="flex min-w-0 flex-1 items-center gap-2 text-[11px] leading-tight text-muted-foreground">
            {#if composerMeta.showDot}
              <span class={composerMeta.dotClass} aria-hidden="true"></span>
            {/if}
            {#if composerMeta.text}
              <span class="truncate">{composerMeta.text}</span>
            {:else if desktopState.canUseSession && !desktopState.isBusy && !isRunning && !desktopState.isSendingPrompt}
              <span class="hidden shrink-0 items-center gap-1 sm:inline-flex"><Kbd>Enter</Kbd> send</span>
              <span class="hidden shrink-0 items-center gap-1 md:inline-flex"><Kbd>Shift</Kbd><Kbd>Enter</Kbd> newline</span>
              {#if showSlashHint}
                <span class="hidden shrink-0 items-center gap-1 lg:inline-flex"><Kbd>/</Kbd> commands</span>
              {/if}
            {/if}
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-0.5">
          {#if showAbort}
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:text-foreground"
              aria-label="Abort run"
              title="Abort run"
              onclick={() => desktopState.handleAbort()}
              disabled={desktopState.isBusy}
            >
              <HugeiconsIcon icon={StopCircleIcon} data-icon />
            </Button>
          {/if}
          <PromptInputSubmit
            variant={desktopState.canSubmit ? "default" : "ghost"}
            size="icon"
            data-prompt-input-submit
            class="size-8 shrink-0 rounded-md shadow-none {desktopState.canSubmit
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground'}"
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
