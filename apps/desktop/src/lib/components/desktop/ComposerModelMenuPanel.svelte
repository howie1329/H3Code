<script lang="ts">
  import ComposerSelectMenu from "$lib/components/desktop/ComposerSelectMenu.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    getModelId,
    getModelLabel,
    groupModelsByProvider,
    isSameModel,
  } from "$lib/pi-model.js";

  type Props = {
    open: boolean;
    menuLeft?: number;
    modelHighlightedIndex?: number;
    onSelectModel: (model: PiModel) => void;
    onHighlightModel: (index: number) => void;
    onRetryModels: () => void;
  };

  let {
    open,
    menuLeft = 0,
    modelHighlightedIndex = 0,
    onSelectModel,
    onHighlightModel,
    onRetryModels,
  }: Props = $props();

  const currentModel = $derived(desktopState.sessionState?.model);
  const groupedModels = $derived(groupModelsByProvider(desktopState.availableModels));
  const flatModels = $derived(desktopState.availableModels);

  const rowClass = (highlighted: boolean) =>
    highlighted
      ? "flex h-7 w-full items-center gap-2 bg-accent px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      : "flex h-7 w-full items-center gap-2 px-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";
</script>

<ComposerSelectMenu
  {open}
  title="Model"
  description="Provider model for this session."
  loading={desktopState.modelsLoading}
  error={desktopState.modelsError ? "Couldn't load models" : undefined}
  align={{ left: menuLeft, width: 280 }}
  ariaLabel="Select model"
  onRetry={onRetryModels}
>
  <div class="max-h-64 overflow-y-auto py-1">
    {#if desktopState.availableModels.length === 0}
      <div class="px-3 py-2 text-xs text-muted-foreground">No models configured in Pi.</div>
    {:else}
      {#each groupedModels as group}
        <div class="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/80 first:pt-1">
          {group.provider}
        </div>
        {#each group.models as model (getModelId(model))}
          {@const flatIndex = flatModels.findIndex((entry) => isSameModel(entry, model))}
          <button
            type="button"
            class={rowClass(flatIndex === modelHighlightedIndex)}
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
  </div>
</ComposerSelectMenu>
