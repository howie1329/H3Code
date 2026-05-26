<script lang="ts">
  import { tick } from "svelte";
  import { ArrowUp02Icon, StopCircleIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import ComposerSelectMenu from "$lib/components/desktop/ComposerSelectMenu.svelte";
  import ModelSelector from "$lib/components/desktop/ModelSelector.svelte";
  import SlashCommandMenu from "$lib/components/desktop/SlashCommandMenu.svelte";
  import ThinkingLevelSelector from "$lib/components/desktop/ThinkingLevelSelector.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    getModelId,
    getModelLabel,
    groupModelsByProvider,
    isSameModel,
    modelSupportsThinking,
    normalizeThinkingLevel,
    PI_THINKING_LEVELS,
    PI_THINKING_LEVEL_LABELS,
  } from "$lib/pi-model.js";
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
  const showAbort = $derived(desktopState.isAgentRunning || desktopState.sessionState?.isStreaming);
  const isRunning = $derived(desktopState.isAgentRunning || desktopState.sessionState?.isStreaming);
  const showSlashHint = $derived(
    desktopState.canUseSession && desktopState.slashCommands.length > 0 && !desktopState.slashCommandsLoading
  );
  const selectorsDisabled = $derived(!desktopState.canChangeSessionSettings || !desktopState.canUseSession);
  const currentModel = $derived(desktopState.sessionState?.model);
  const groupedModels = $derived(groupModelsByProvider(desktopState.availableModels));
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
        dotClass: "size-1.5 shrink-0 rounded-full bg-primary",
        text: "Pi is running · Enter queues follow-up · Shift+Enter steers",
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

    if (menu === "model" && !selectorsDisabled && desktopState.availableModels.length > 1) {
      activeMenu = "model";
      slashToken = null;
      dismissedTokenKey = undefined;
      const currentIndex = flatModels.findIndex((entry) => isSameModel(entry, currentModel));
      modelHighlightedIndex = currentIndex >= 0 ? currentIndex : 0;
      void desktopState.ensureAvailableModels();
      return;
    }

    if (menu === "thinking" && !selectorsDisabled && showThinkingSelector) {
      activeMenu = "thinking";
      slashToken = null;
      dismissedTokenKey = undefined;
      const currentIndex = PI_THINKING_LEVELS.indexOf(currentThinkingLevel);
      thinkingHighlightedIndex = currentIndex >= 0 ? currentIndex : 0;
    }
  }

  function toggleMenu(menu: "model" | "thinking") {
    if (activeMenu === menu) {
      closeMenus();
      return;
    }

    openMenu(menu);
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
        thinkingHighlightedIndex = (thinkingHighlightedIndex - 1 + PI_THINKING_LEVELS.length) % PI_THINKING_LEVELS.length;
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void selectThinkingLevel(PI_THINKING_LEVELS[thinkingHighlightedIndex]);
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

    <ComposerSelectMenu
      open={activeMenu === "model"}
      title="Model"
      description="Applies to this PI session."
      loading={desktopState.modelsLoading}
      error={desktopState.modelsError ? "Couldn't load models" : undefined}
      align={{ left: modelMenuLeft, width: 256 }}
      ariaLabel="Available models"
      onRetry={retryModels}
    >
      {#if desktopState.availableModels.length === 0}
        <div class="px-3 py-4 text-xs text-muted-foreground">No models configured in PI.</div>
      {:else}
        <div class="max-h-56 overflow-y-auto py-1">
          {#each groupedModels as group}
            <div class="px-2 pb-1 pt-2 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground first:pt-1">
              {group.provider}
            </div>

            {#each group.models as model (getModelId(model))}
              {@const flatIndex = flatModels.findIndex((entry) => isSameModel(entry, model))}
              <button
                type="button"
                class={flatIndex === modelHighlightedIndex
                  ? "flex w-full items-center gap-2 bg-accent px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  : "flex w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"}
                role="option"
                aria-selected={isSameModel(model, currentModel)}
                onmouseenter={() => {
                  if (flatIndex >= 0) {
                    modelHighlightedIndex = flatIndex;
                  }
                }}
                onmousedown={(event) => event.preventDefault()}
                onclick={() => selectModel(model)}
              >
                <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">{getModelLabel(model)}</span>
                {#if isSameModel(model, currentModel)}
                  <span class="shrink-0 text-[10px] text-muted-foreground">Current</span>
                {/if}
              </button>
            {/each}
          {/each}
        </div>
      {/if}
    </ComposerSelectMenu>

    <ComposerSelectMenu
      open={activeMenu === "thinking"}
      title="Thinking"
      description="Reasoning depth for this model."
      align={{ left: thinkingMenuLeft, width: 176 }}
      ariaLabel="Thinking levels"
    >
      <div class="max-h-56 overflow-y-auto py-1">
        {#each PI_THINKING_LEVELS as level, index}
          <button
            type="button"
            class={index === thinkingHighlightedIndex
              ? "flex w-full items-center gap-2 bg-accent px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              : "flex w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"}
            role="option"
            aria-selected={level === currentThinkingLevel}
            onmouseenter={() => (thinkingHighlightedIndex = index)}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => selectThinkingLevel(level)}
          >
            <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">{PI_THINKING_LEVEL_LABELS[level]}</span>
            {#if level === currentThinkingLevel}
              <span class="shrink-0 text-[10px] text-muted-foreground">Current</span>
            {/if}
          </button>
        {/each}
      </div>
    </ComposerSelectMenu>

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
        <div class="flex min-w-0 flex-1 items-center gap-1.5">
          <ModelSelector
            open={activeMenu === "model"}
            disabled={selectorsDisabled}
            bind:anchor={modelAnchor}
            onToggle={() => toggleMenu("model")}
          />
          <ThinkingLevelSelector
            open={activeMenu === "thinking"}
            disabled={selectorsDisabled}
            bind:anchor={thinkingAnchor}
            onToggle={() => toggleMenu("thinking")}
          />
          <div class="flex min-w-0 flex-1 items-center gap-2 text-[11px] leading-tight text-muted-foreground">
            {#if composerMeta.showDot}
              <span class={composerMeta.dotClass} aria-hidden="true"></span>
            {/if}
            {#if desktopState.canUseSession && !desktopState.isBusy && !isRunning && !desktopState.isSendingPrompt}
              <span class="hidden shrink-0 items-center gap-1 sm:inline-flex"><Kbd>Enter</Kbd> send</span>
              <span class="hidden shrink-0 items-center gap-1 md:inline-flex"><Kbd>Shift</Kbd><Kbd>Enter</Kbd> newline</span>
              {#if showSlashHint}
                <span class="hidden shrink-0 items-center gap-1 lg:inline-flex"><Kbd>/</Kbd> commands</span>
              {/if}
            {:else}
              <span class="truncate">{composerMeta.text}</span>
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
