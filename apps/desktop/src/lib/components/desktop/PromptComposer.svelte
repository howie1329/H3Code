<script lang="ts">
  import type { ProviderCommand, ProviderModel } from "$lib/desktop-types.js";
  import type { ThinkingLevel } from "$lib/provider-model.js";
  import { tick } from "svelte";
  import {
    Alert01Icon,
    AlertCircleIcon,
    ArrowUp02Icon,
    Cancel01Icon,
    InformationCircleIcon,
    SquareIcon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import {
    SESSION_SETTINGS_STATIC_LABEL_CLASS,
  } from "$lib/components/desktop/composer-menu.js";
  import SessionSettingsMenu from "$lib/components/desktop/SessionSettingsMenu.svelte";
  import SessionSettingsTrigger from "$lib/components/desktop/SessionSettingsTrigger.svelte";
  import SlashCommandMenu from "$lib/components/desktop/SlashCommandMenu.svelte";
  import {
    WORKSPACE_COLUMN_INSET_CLASS,
    WORKSPACE_COLUMN_MAX_W_CLASS,
  } from "$lib/components/desktop/workspace-column.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    getModelLabel,
    isSameModel,
    mergeModelWithCatalog,
    modelSupportsThinking,
    normalizeModel,
    normalizeThinkingLevel,
    THINKING_LEVELS,
  } from "$lib/provider-model.js";
  import {
    filterSlashCommands,
    findCompletedSkillToken,
    getActiveSlashToken,
    removeSlashToken,
    replaceSlashToken,
    type SlashToken,
  } from "$lib/slash-commands";
  import {
    PromptInput,
    PromptInputBody,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
    PromptInputTools,
    type ChatStatus,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import { cn } from "$lib/utils.js";

  type ComposerMenu = "none" | "slash" | "settings";

  let { floating = false }: { floating?: boolean } = $props();

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let settingsAnchor = $state<HTMLElement | null>(null);
  let slashToken = $state<SlashToken | null>(null);
  let dismissedTokenKey = $state<string | undefined>();
  let activeMenu = $state<ComposerMenu>("none");
  let slashHighlightedIndex = $state(0);
  let settingsHighlightedIndex = $state(0);
  let selectedSkillCommands = $state<ProviderCommand[]>([]);

  const filteredCommands = $derived(slashToken ? filterSlashCommands(desktopState.slashCommands, slashToken.query) : []);
  const skillCommands = $derived(desktopState.slashCommands.filter((command) => command.source === "skill"));
  const tokenKey = $derived(slashToken ? `${slashToken.start}:${slashToken.end}:${slashToken.query}` : undefined);
  const isSlashMenuOpen = $derived(activeMenu === "slash" && Boolean(slashToken && tokenKey !== dismissedTokenKey));
  const isRunning = $derived(desktopState.isAgentRunning);
  const showSessionControls = $derived(desktopState.canUseSession);
  const submitStatus = $derived.by((): ChatStatus => {
    if (isRunning) {
      return "streaming";
    }

    if (desktopState.isSendingPrompt) {
      return "submitted";
    }

    return "ready";
  });
  const showSlashHint = $derived(
    desktopState.supportsSlashCommands &&
      desktopState.canUseSession &&
      desktopState.slashCommands.length > 0 &&
      !desktopState.slashCommandsLoading,
  );
  const selectorsDisabled = $derived(!desktopState.canChangeSessionSettings || !desktopState.canUseSession);
  const settingsDisabled = $derived(selectorsDisabled);
  const currentModel = $derived(
    mergeModelWithCatalog(desktopState.sessionReadModel.model, desktopState.availableModels) ??
      normalizeModel(desktopState.sessionReadModel.model),
  );
  const flatModels = $derived(desktopState.availableModels);
  const supportsThinking = $derived(modelSupportsThinking(currentModel, flatModels));
  const hasMultipleModels = $derived(flatModels.length > 1);
  const showSessionSettings = $derived(
    showSessionControls &&
      (desktopState.supportsModelPicker || supportsThinking) &&
      (desktopState.modelsLoading || hasMultipleModels || supportsThinking),
  );
  const showStaticSessionLabel = $derived(
    showSessionControls && !showSessionSettings && !desktopState.modelsLoading,
  );
  const staticSessionLabel = $derived(getModelLabel(currentModel));
  const settingsItemCount = $derived(
    flatModels.length + (supportsThinking ? THINKING_LEVELS.length : 0),
  );

  const promptPlaceholder = $derived.by(() => {
    if (desktopState.canUseSession) {
      return "Ask Pi about this repo…";
    }

    if (!desktopState.repoPath) {
      return "Select a repo and session…";
    }

    if (desktopState.connectionStatus.state !== "connected") {
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

  const submitTitle = $derived.by(() => {
    if (isRunning) {
      return "Stop run";
    }

    if (desktopState.isSendingPrompt) {
      return "Sending prompt";
    }

    return "Send prompt";
  });

  $effect(() => {
    if (slashHighlightedIndex >= filteredCommands.length) {
      slashHighlightedIndex = 0;
    }
  });

  $effect(() => {
    if (settingsHighlightedIndex >= settingsItemCount) {
      settingsHighlightedIndex = 0;
    }
  });

  $effect(() => {
    if (desktopState.canUseSession && desktopState.supportsModelPicker) {
      void desktopState.ensureAvailableModels();
    }
  });

  $effect(() => {
    if (!desktopState.activeSessionId) {
      selectedSkillCommands = [];
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

  function closeMenus() {
    activeMenu = "none";
  }

  function initialSettingsHighlightIndex() {
    const modelIndex = flatModels.findIndex((entry) => isSameModel(entry, currentModel));

    if (modelIndex >= 0) {
      return modelIndex;
    }

    if (supportsThinking) {
      const level = normalizeThinkingLevel(undefined);
      return flatModels.length + Math.max(0, THINKING_LEVELS.indexOf(level));
    }

    return 0;
  }

  function toggleSettingsMenu() {
    if (settingsDisabled) {
      return;
    }

    if (activeMenu === "settings") {
      closeMenus();
      return;
    }

    slashToken = null;
    dismissedTokenKey = undefined;
    activeMenu = "settings";
    settingsHighlightedIndex = initialSettingsHighlightIndex();
    void desktopState.ensureAvailableModels();
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
    convertCompletedSkillToken();
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

    if (activeMenu === "settings" && settingsItemCount > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        settingsHighlightedIndex = (settingsHighlightedIndex + 1) % settingsItemCount;
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        settingsHighlightedIndex = (settingsHighlightedIndex - 1 + settingsItemCount) % settingsItemCount;
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void selectSettingsItem(settingsHighlightedIndex);
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

  async function insertCommand(command: ProviderCommand) {
    if (!textareaRef || !slashToken) {
      return;
    }

    const nextPrompt =
      command.source === "skill"
        ? selectSkillCommand(command, slashToken)
        : replaceSlashToken(desktopState.promptValue, slashToken, command);

    desktopState.promptValue = nextPrompt.value;
    slashToken = null;
    dismissedTokenKey = undefined;
    closeMenus();

    await tick();
    textareaRef?.focus();
    textareaRef?.setSelectionRange(nextPrompt.cursor, nextPrompt.cursor);
  }

  function selectSkillCommand(command: ProviderCommand, token: SlashToken) {
    if (!selectedSkillCommands.some((skill) => skill.name === command.name)) {
      selectedSkillCommands = [...selectedSkillCommands, command];
    }

    return removeSlashToken(desktopState.promptValue, token);
  }

  function convertCompletedSkillToken() {
    const completed = findCompletedSkillToken(desktopState.promptValue, skillCommands);

    if (!completed) {
      return;
    }

    const nextPrompt = selectSkillCommand(completed.command, completed.token);
    desktopState.promptValue = nextPrompt.value;

    queueMicrotask(() => {
      textareaRef?.setSelectionRange(nextPrompt.cursor, nextPrompt.cursor);
    });
  }

  function removeSelectedSkill(command: ProviderCommand) {
    selectedSkillCommands = selectedSkillCommands.filter((skill) => skill.name !== command.name);
    void tick().then(() => textareaRef?.focus());
  }

  function skillCommandText() {
    return selectedSkillCommands.map((command) => `/${command.name}`).join("\n");
  }

  function buildPromptText(text: string | undefined) {
    const body = text?.trim() ?? "";
    const skills = skillCommandText();

    if (!skills) {
      return body;
    }

    return body ? `${skills}\n\n${body}` : skills;
  }

  async function retryCommands() {
    await desktopState.ensureSlashCommands(true);
    syncSlashToken();
  }

  async function retryModels() {
    await desktopState.ensureAvailableModels(true);
  }

  async function selectModel(model: ProviderModel) {
    closeMenus();
    await desktopState.setProviderModel(model);
    await tick();
    textareaRef?.focus();
  }

  async function selectThinkingLevel(level: ThinkingLevel) {
    closeMenus();
    await desktopState.setThinkingLevel(level);
    await tick();
    textareaRef?.focus();
  }

  async function selectSettingsItem(index: number) {
    if (index < flatModels.length) {
      const model = flatModels[index];

      if (model) {
        await selectModel(model);
      }

      return;
    }

    const level = THINKING_LEVELS[index - flatModels.length];

    if (level) {
      await selectThinkingLevel(level);
    }
  }

  function getNotificationIcon(type: "info" | "warning" | "error") {
    if (type === "error") {
      return AlertCircleIcon;
    }

    if (type === "warning") {
      return Alert01Icon;
    }

    return InformationCircleIcon;
  }

  function getNotificationClass(type: "info" | "warning" | "error") {
    if (type === "error") {
      return "border-destructive/35 bg-destructive/10 text-foreground";
    }

    if (type === "warning") {
      return "border-amber-500/35 bg-amber-500/10 text-foreground";
    }

    return "border-border/60 bg-muted/35 text-foreground";
  }

  function getNotificationIconClass(type: "info" | "warning" | "error") {
    if (type === "error") {
      return "text-destructive";
    }

    if (type === "warning") {
      return "text-amber-600 dark:text-amber-400";
    }

    return "text-primary";
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div
  class={cn(
    floating
      ? cn(
          "pointer-events-none bg-[linear-gradient(to_top,var(--background)_60%,transparent)] pt-8 pb-3",
          WORKSPACE_COLUMN_INSET_CLASS,
        )
      : cn("border-t border-border/50 py-1.5", WORKSPACE_COLUMN_INSET_CLASS),
  )}
>
  <div
    bind:this={wrapperRef}
    class={cn(
      "relative mx-auto w-full",
      floating ? cn("pointer-events-auto", WORKSPACE_COLUMN_MAX_W_CLASS) : WORKSPACE_COLUMN_MAX_W_CLASS,
    )}
  >
    {#if desktopState.sessionNotification}
      {@const notification = desktopState.sessionNotification}
      <div
        class="mb-2 flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] leading-tight {getNotificationClass(notification.notifyType)}"
        role={notification.notifyType === "error" ? "alert" : "status"}
        aria-live={notification.notifyType === "error" ? "assertive" : "polite"}
      >
        <HugeiconsIcon
          icon={getNotificationIcon(notification.notifyType)}
          class="mt-0.5 size-3 shrink-0 {getNotificationIconClass(notification.notifyType)}"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">{notification.message}</span>
        <button
          type="button"
          class="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
          aria-label="Dismiss notification"
          title="Dismiss notification"
          onclick={() => desktopState.dismissSessionNotification(notification.id)}
        >
          <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
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

    <SessionSettingsMenu
      open={activeMenu === "settings"}
      anchor={settingsAnchor}
      highlightedIndex={settingsHighlightedIndex}
      onHighlight={(index) => (settingsHighlightedIndex = index)}
      onSelectModel={(model) => selectModel(model)}
      onSelectThinkingLevel={(level) => selectThinkingLevel(level)}
      onRetryModels={retryModels}
    />

    <PromptInput
      onSubmit={async (message, event) => {
        slashToken = null;
        dismissedTokenKey = undefined;
        closeMenus();
        await desktopState.handlePromptSubmit({ ...message, text: buildPromptText(message.text) }, event);
        selectedSkillCommands = [];
      }}
      class="w-full"
    >
      <PromptInputBody>
        {#if selectedSkillCommands.length > 0}
          <div class="flex flex-wrap gap-1.5 border-b border-border/40 px-2.5 py-1.5" aria-label="Selected skills">
            {#each selectedSkillCommands as skill (skill.name)}
              <span
                class="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-foreground"
                title={`/${skill.name}`}
              >
                <span class="truncate">/{skill.name}</span>
                <button
                  type="button"
                  class="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 [&_svg]:size-2.5"
                  aria-label={`Remove /${skill.name}`}
                  title={`Remove /${skill.name}`}
                  onclick={() => removeSelectedSkill(skill)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
                </button>
              </span>
            {/each}
          </div>
        {/if}
        <label for="prompt" class="sr-only">Prompt</label>
        <PromptInputTextarea
          id="prompt"
          bind:ref={textareaRef}
          bind:value={desktopState.promptValue}
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
      </PromptInputBody>

      <PromptInputToolbar>
        <PromptInputTools>
          {#if showSessionControls}
            <div class="flex min-w-0 shrink items-center" role="group" aria-label="Session settings">
              {#if showStaticSessionLabel}
                <span class={SESSION_SETTINGS_STATIC_LABEL_CLASS} title={staticSessionLabel}>
                  {staticSessionLabel}
                </span>
              {:else if showSessionSettings}
                <SessionSettingsTrigger
                  open={activeMenu === "settings"}
                  disabled={settingsDisabled}
                  bind:anchor={settingsAnchor}
                  onToggle={toggleSettingsMenu}
                />
              {/if}
            </div>
          {/if}
        </PromptInputTools>

        <PromptInputSubmit
          status={submitStatus}
          variant={desktopState.canSubmit || isRunning ? "default" : "ghost"}
          size="icon"
          data-prompt-input-submit
          class="shrink-0"
          title={submitTitle}
          disabled={!isRunning && !desktopState.canSubmit}
          onStop={() => desktopState.handleAbort()}
        >
          {#if isRunning}
            <HugeiconsIcon icon={SquareIcon} data-icon class="size-3.5" />
          {:else}
            <HugeiconsIcon icon={ArrowUp02Icon} data-icon class="size-3.5" />
          {/if}
        </PromptInputSubmit>
      </PromptInputToolbar>
    </PromptInput>
  </div>
</div>
