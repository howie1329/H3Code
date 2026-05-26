<script lang="ts">
  import { tick } from "svelte";
  import { ArrowUp02Icon, StopCircleIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import ComposerModelMenuPanel from "$lib/components/desktop/ComposerModelMenuPanel.svelte";
  import ComposerThinkingMenuPanel from "$lib/components/desktop/ComposerThinkingMenuPanel.svelte";
  import ModelSelector from "$lib/components/desktop/ModelSelector.svelte";
  import PromptComposerField from "$lib/components/desktop/PromptComposerField.svelte";
  import SlashCommandMenu from "$lib/components/desktop/SlashCommandMenu.svelte";
  import ThinkingLevelSelector from "$lib/components/desktop/ThinkingLevelSelector.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { isSameModel, normalizeThinkingLevel, PI_THINKING_LEVELS } from "$lib/pi-model.js";
  import { filterSlashCommands, getActiveSlashToken, replaceSlashToken, type SlashToken } from "$lib/slash-commands";
  import {
    PromptInput,
    PromptInputSubmit,
    PromptInputTextarea,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  type ComposerMenu = "none" | "slash" | "model" | "thinking";

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let modelAnchor = $state<HTMLElement | null>(null);
  let thinkingAnchor = $state<HTMLElement | null>(null);
  let slashToken = $state<SlashToken | null>(null);
  let dismissedTokenKey = $state<string | undefined>();
  let activeMenu = $state<ComposerMenu>("none");
  let slashHighlightedIndex = $state(0);
  let modelHighlightedIndex = $state(0);
  let thinkingHighlightedIndex = $state(0);
  let modelMenuLeft = $state(0);
  let thinkingMenuLeft = $state(0);

  const filteredCommands = $derived(slashToken ? filterSlashCommands(desktopState.slashCommands, slashToken.query) : []);
  const tokenKey = $derived(slashToken ? `${slashToken.start}:${slashToken.end}:${slashToken.query}` : undefined);
  const isSlashMenuOpen = $derived(activeMenu === "slash" && Boolean(slashToken && tokenKey !== dismissedTokenKey));
  const isRunning = $derived(desktopState.isAgentRunning || desktopState.sessionState?.isStreaming);
  const showAbort = $derived(isRunning);
  const showSlashHint = $derived(
    desktopState.canUseSession && desktopState.slashCommands.length > 0 && !desktopState.slashCommandsLoading
  );
  const selectorsDisabled = $derived(!desktopState.canChangeSessionSettings || !desktopState.canUseSession);
  const currentModel = $derived(desktopState.sessionState?.model);
  const flatModels = $derived(desktopState.availableModels);
  const currentThinkingLevel = $derived(normalizeThinkingLevel(desktopState.sessionState?.thinkingLevel));

  const promptPlaceholder = $derived.by(() => {
    if (desktopState.canUseSession) {
      return "Ask Pi about this repo…";
    }

    if (!desktopState.repoPath) {
      return "Select a repo and session…";
    }

    if (desktopState.piStatus.state !== "connected") {
      return "Connect Pi to send prompts…";
    }

    return "Select a repo and session…";
  });

  const textareaTitle = $derived.by(() => {
    if (!desktopState.canUseSession || desktopState.isBusy || isRunning) {
      return undefined;
    }

    const base = "Enter to send · Shift+Enter for new line";
    return showSlashHint ? `${base} · / for commands` : base;
  });

  const composerMeta = $derived.by(() => {
    if (desktopState.isSendingPrompt) {
      return { showDot: true, dotClass: "size-1.5 shrink-0 animate-pulse rounded-full bg-primary", text: "Sending…" };
    }

    const phase = desktopState.composerPhaseLine;

    if (phase) {
      const showDot = phase.tone === "working" || phase.tone === "warning" || phase.tone === "error";
      const dotClass =
        phase.tone === "error"
          ? "size-1.5 shrink-0 rounded-full bg-destructive"
          : phase.tone === "warning"
            ? "size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500"
            : phase.tone === "working"
              ? "size-1.5 shrink-0 animate-pulse rounded-full bg-primary"
              : "size-1.5 shrink-0 rounded-full bg-muted-foreground/60";

      return { showDot, dotClass, text: phase.text };
    }

    const stripLines = desktopState.statusStripLines;

    if (stripLines.length > 0) {
      return { showDot: false, dotClass: "", text: stripLines.join(" · ") };
    }

    if (!desktopState.canUseSession) {
      if (!desktopState.repoPath) {
        return { showDot: false, dotClass: "", text: "Select a repository to send prompts" };
      }

      if (desktopState.piStatus.state !== "connected") {
        return { showDot: false, dotClass: "", text: "Connect Pi to send prompts" };
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

  const showStatusLine = $derived(Boolean(composerMeta.text));

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
    if (activeMenu === "model") {
      updateMenuPosition(modelAnchor, (left) => (modelMenuLeft = left));
    }
  });

  $effect(() => {
    if (activeMenu === "thinking") {
      updateMenuPosition(thinkingAnchor, (left) => (thinkingMenuLeft = left));
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

    if (selectorsDisabled) {
      return;
    }

    slashToken = null;
    dismissedTokenKey = undefined;

    if (menu === "model") {
      activeMenu = "model";
      const currentIndex = flatModels.findIndex((entry) => isSameModel(entry, currentModel));
      modelHighlightedIndex = currentIndex >= 0 ? currentIndex : 0;
      void desktopState.ensureAvailableModels();
      return;
    }

    if (menu === "thinking") {
      activeMenu = "thinking";
      thinkingHighlightedIndex = PI_THINKING_LEVELS.indexOf(currentThinkingLevel);
    }
  }

  function toggleModelMenu() {
    if (activeMenu === "model") {
      closeMenus();
      return;
    }

    openMenu("model");
  }

  function toggleThinkingMenu() {
    if (activeMenu === "thinking") {
      closeMenus();
      return;
    }

    openMenu("thinking");
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

    if (activeMenu === "model" && flatModels.length > 0) {
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

    if (activeMenu === "thinking") {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        thinkingHighlightedIndex = (thinkingHighlightedIndex + 1) % PI_THINKING_LEVELS.length;
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        thinkingHighlightedIndex =
          (thinkingHighlightedIndex - 1 + PI_THINKING_LEVELS.length) % PI_THINKING_LEVELS.length;
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const level = PI_THINKING_LEVELS[thinkingHighlightedIndex];

        if (level) {
          void selectThinkingLevel(level);
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

<div class="border-t border-border/50 px-6 py-1.5">
  <div bind:this={wrapperRef} class="relative mx-auto max-w-3xl">
    {#if desktopState.sessionNotification}
      <div
        class="mb-2 flex items-start justify-between gap-3 border border-border/60 bg-muted/30 px-3 py-2 text-[11px] leading-tight text-foreground"
        role="status"
        aria-live="polite"
      >
        <span>{desktopState.sessionNotification.message}</span>
        <button
          type="button"
          class="shrink-0 text-muted-foreground hover:text-foreground"
          onclick={() => desktopState.dismissSessionNotification(desktopState.sessionNotification!.id)}
        >
          Dismiss
        </button>
      </div>
    {/if}
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

    <ComposerModelMenuPanel
      open={activeMenu === "model"}
      menuLeft={modelMenuLeft}
      {modelHighlightedIndex}
      onSelectModel={(model) => selectModel(model)}
      onHighlightModel={(index) => (modelHighlightedIndex = index)}
      onRetryModels={retryModels}
    />

    <ComposerThinkingMenuPanel
      open={activeMenu === "thinking"}
      menuLeft={thinkingMenuLeft}
      {thinkingHighlightedIndex}
      onSelectThinkingLevel={(level) => selectThinkingLevel(level)}
      onHighlightThinking={(index) => (thinkingHighlightedIndex = index)}
    />

    <PromptInput
      onSubmit={(message, event) => {
        slashToken = null;
        dismissedTokenKey = undefined;
        closeMenus();
        desktopState.handlePromptSubmit(message, event);
      }}
      class="w-full overflow-visible rounded-none border-0 bg-transparent shadow-none"
    >
      <PromptComposerField showStatus={showStatusLine}>
        {#snippet input()}
          <label for="prompt" class="sr-only">Prompt</label>
          <PromptInputTextarea
            id="prompt"
            bind:ref={textareaRef}
            bind:value={desktopState.promptValue}
            class="max-h-40 min-h-5! w-full resize-none border-none bg-transparent p-0 text-[11px] leading-tight text-foreground shadow-none placeholder:text-[11px] placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={promptPlaceholder}
            title={textareaTitle}
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
        {/snippet}

        {#snippet trailing()}
          <ModelSelector
            open={activeMenu === "model"}
            disabled={selectorsDisabled}
            variant="inline"
            bind:anchor={modelAnchor}
            onToggle={toggleModelMenu}
          />
          <ThinkingLevelSelector
            open={activeMenu === "thinking"}
            disabled={selectorsDisabled}
            variant="inline"
            bind:anchor={thinkingAnchor}
            onToggle={toggleThinkingMenu}
          />
          <span class="mx-0.5 h-4 w-px shrink-0 bg-border/50" aria-hidden="true"></span>
          {#if showAbort}
            <Button
              variant="ghost"
              size="icon-sm"
              class="size-7 text-muted-foreground hover:text-foreground"
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
            class="size-7 shrink-0 rounded-full shadow-none {desktopState.canSubmit
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground'}"
            title="Send prompt"
            disabled={!desktopState.canSubmit}
          >
            <HugeiconsIcon icon={ArrowUp02Icon} data-icon />
          </PromptInputSubmit>
        {/snippet}

        {#snippet status()}
          {#if composerMeta.showDot}
            <span class={composerMeta.dotClass} aria-hidden="true"></span>
          {/if}
          <span class="truncate">{composerMeta.text}</span>
        {/snippet}
      </PromptComposerField>
    </PromptInput>
  </div>
</div>
