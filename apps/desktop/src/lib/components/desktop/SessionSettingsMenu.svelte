<script lang="ts">
  import type { ProviderCommand, ProviderModel, ProviderQueueMode } from "$lib/desktop-types.js";
  import type { SessionSummary } from "$lib/session-types.js";
  import type { ThinkingLevel } from "$lib/provider-model.js";
  import CheckIcon from "@lucide/svelte/icons/check";

  import ComposerSelectMenu from "$lib/components/desktop/ComposerSelectMenu.svelte";
  import {
    COMPOSER_MENU_GROUP_LABEL_CLASS,
    COMPOSER_MENU_HEADER_DESC_CLASS,
    COMPOSER_MENU_HEADER_TITLE_CLASS,
    composerMenuRowClass,
  } from "$lib/components/desktop/composer-menu.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    getModelId,
    getModelLabel,
    groupModelsByProvider,
    isSameModel,
    mergeModelWithCatalog,
    modelSupportsThinking,
    normalizeModel,
    normalizeThinkingLevel,
    THINKING_LEVEL_LABELS,
    THINKING_LEVELS,
  } from "$lib/provider-model.js";

  type Props = {
    open: boolean;
    anchor: HTMLElement | null;
    highlightedIndex: number;
    onHighlight: (index: number) => void;
    onSelectModel: (model: ProviderModel) => void;
    onSelectThinkingLevel: (level: ThinkingLevel) => void;
    onRetryModels: () => void;
  };

  let {
    open,
    anchor,
    highlightedIndex,
    onHighlight,
    onSelectModel,
    onSelectThinkingLevel,
    onRetryModels,
  }: Props = $props();

  const currentModel = $derived(
    mergeModelWithCatalog(desktopState.currentProviderModel, desktopState.availableModels) ??
      normalizeModel(desktopState.currentProviderModel),
  );
  const groupedModels = $derived(groupModelsByProvider(desktopState.availableModels));
  const flatModels = $derived(desktopState.availableModels);
  const catalog = $derived(desktopState.availableModels);
  const supportsThinking = $derived(modelSupportsThinking(currentModel, catalog));
  const currentThinkingLevel = $derived(normalizeThinkingLevel(desktopState.currentThinkingLevel));
  const thinkingOffset = $derived(flatModels.length);

  function modelFlatIndex(model: ProviderModel) {
    return flatModels.findIndex((entry) => isSameModel(entry, model));
  }

  function isModelHighlighted(model: ProviderModel) {
    const index = modelFlatIndex(model);
    return index >= 0 && index === highlightedIndex;
  }

  function isThinkingHighlighted(index: number) {
    return supportsThinking && thinkingOffset + index === highlightedIndex;
  }
</script>

<ComposerSelectMenu
  {open}
  align={{ mode: "fixed", anchor, width: 300 }}
  ariaLabel="Session settings"
  loading={desktopState.modelsLoading}
  error={desktopState.modelsError ? "Couldn't load models" : undefined}
  onRetry={onRetryModels}
>
  <div class="max-h-[min(20rem,50vh)] overflow-y-auto py-1">
    <div class="border-b border-border/50 px-3 py-2">
      <div class={COMPOSER_MENU_HEADER_TITLE_CLASS}>Model</div>
      <div class={COMPOSER_MENU_HEADER_DESC_CLASS}>Provider model for this session.</div>
    </div>

    {#if desktopState.availableModels.length === 0}
      <div class="px-3 py-2 text-xs text-muted-foreground">No models configured in Pi.</div>
    {:else}
      {#each groupedModels as group}
        <div class={COMPOSER_MENU_GROUP_LABEL_CLASS}>{group.provider}</div>
        {#each group.models as model (getModelId(model))}
          {@const flatIndex = modelFlatIndex(model)}
          <button
            type="button"
            class={composerMenuRowClass(isModelHighlighted(model))}
            role="option"
            aria-selected={isSameModel(model, currentModel)}
            onmouseenter={() => {
              if (flatIndex >= 0) {
                onHighlight(flatIndex);
              }
            }}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => onSelectModel(model)}
          >
            <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">{getModelLabel(model)}</span>
            {#if isSameModel(model, currentModel)}
              <CheckIcon class="size-3 shrink-0 text-foreground" aria-hidden="true" />
            {/if}
          </button>
        {/each}
      {/each}
    {/if}

    {#if supportsThinking}
      <div class="mt-1 border-t border-border/50">
        <div class="px-3 py-2">
          <div class={COMPOSER_MENU_HEADER_TITLE_CLASS}>Thinking levels</div>
          <div class={COMPOSER_MENU_HEADER_DESC_CLASS}>How much extended thinking the model uses for this session.</div>
        </div>
        {#each THINKING_LEVELS as level, index}
          <button
            type="button"
            class={composerMenuRowClass(isThinkingHighlighted(index))}
            role="option"
            aria-selected={level === currentThinkingLevel}
            onmouseenter={() => onHighlight(thinkingOffset + index)}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => onSelectThinkingLevel(level)}
          >
            <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">
              {THINKING_LEVEL_LABELS[level]}
            </span>
            {#if level === currentThinkingLevel}
              <CheckIcon class="size-3 shrink-0 text-foreground" aria-hidden="true" />
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</ComposerSelectMenu>
