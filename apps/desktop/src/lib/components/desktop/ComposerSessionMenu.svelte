<script lang="ts">
  import ComposerPillButton from "$lib/components/desktop/ComposerPillButton.svelte";
  import ComposerSelectMenu from "$lib/components/desktop/ComposerSelectMenu.svelte";
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

  type Props = {
    open: boolean;
    disabled?: boolean;
    menuLeft?: number;
    anchor?: HTMLElement | null;
    modelHighlightedIndex?: number;
    thinkingHighlightedIndex?: number;
    onToggle: () => void;
    onSelectModel: (model: PiModel) => void;
    onSelectThinkingLevel: (level: PiThinkingLevel) => void;
    onHighlightModel: (index: number) => void;
    onHighlightThinking: (index: number) => void;
    onRetryModels: () => void;
  };

  let {
    open,
    disabled = false,
    menuLeft = 0,
    anchor = $bindable(null),
    modelHighlightedIndex = 0,
    thinkingHighlightedIndex = 0,
    onToggle,
    onSelectModel,
    onSelectThinkingLevel,
    onHighlightModel,
    onHighlightThinking,
    onRetryModels,
  }: Props = $props();

  const currentModel = $derived(desktopState.sessionState?.model);
  const groupedModels = $derived(groupModelsByProvider(desktopState.availableModels));
  const flatModels = $derived(desktopState.availableModels);
  const currentThinkingLevel = $derived(normalizeThinkingLevel(desktopState.sessionState?.thinkingLevel));
  const showThinking = $derived(modelSupportsThinking(currentModel));

  const sessionLabel = $derived.by(() => {
    const modelLabel = desktopState.modelsLoading ? "Loading…" : getModelLabel(currentModel);
    if (!showThinking) {
      return modelLabel;
    }

    return `${modelLabel} · ${PI_THINKING_LEVEL_LABELS[currentThinkingLevel]}`;
  });

  const canOpenMenu = $derived(
    !disabled &&
      (desktopState.availableModels.length > 1 || showThinking || desktopState.modelsLoading)
  );
</script>

<ComposerPillButton
  bind:anchor
  label={sessionLabel}
  {open}
  disabled={disabled || !canOpenMenu}
  ariaLabel="Session settings"
  title="Model and thinking level"
  maxWidthClass="max-w-[14rem]"
  showChevron={canOpenMenu}
  onToggle={canOpenMenu ? onToggle : undefined}
/>

<ComposerSelectMenu
  {open}
  title="Session"
  description="Model and reasoning for this Pi session."
  loading={desktopState.modelsLoading}
  error={desktopState.modelsError ? "Couldn't load models" : undefined}
  align={{ left: menuLeft, width: 280 }}
  ariaLabel="Session settings"
  onRetry={onRetryModels}
>
  <div class="max-h-64 overflow-y-auto py-1">
    {#if desktopState.availableModels.length === 0}
      <div class="px-3 py-2 text-xs text-muted-foreground">No models configured in Pi.</div>
    {:else}
      <div class="px-2 pb-1 pt-2 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground first:pt-1">
        Model
      </div>
      {#each groupedModels as group}
        <div class="px-2 pb-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/80">
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
                onHighlightModel(flatIndex);
              }
            }}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => onSelectModel(model)}
          >
            <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">{getModelLabel(model)}</span>
            {#if isSameModel(model, currentModel)}
              <span class="shrink-0 text-[10px] text-muted-foreground">Current</span>
            {/if}
          </button>
        {/each}
      {/each}
    {/if}

    {#if showThinking}
      <div class="mx-2 my-2 border-t border-border/50"></div>
      <div class="px-2 pb-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
        Thinking
      </div>
      {#each PI_THINKING_LEVELS as level, index}
        <button
          type="button"
          class={index === thinkingHighlightedIndex
            ? "flex w-full items-center gap-2 bg-accent px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            : "flex w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"}
          role="option"
          aria-selected={level === currentThinkingLevel}
          onmouseenter={() => onHighlightThinking(index)}
          onmousedown={(event) => event.preventDefault()}
          onclick={() => onSelectThinkingLevel(level)}
        >
          <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">{PI_THINKING_LEVEL_LABELS[level]}</span>
          {#if level === currentThinkingLevel}
            <span class="shrink-0 text-[10px] text-muted-foreground">Current</span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</ComposerSelectMenu>
