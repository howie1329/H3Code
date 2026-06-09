<script lang="ts">
  import ComposerPillButton from "$lib/components/desktop/ComposerPillButton.svelte";
  import type { ProviderModel } from "$lib/desktop-types.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    getModelId,
    getModelLabel,
    groupModelsByProvider,
    mergeModelWithCatalog,
    modelSupportsThinking,
    normalizeModel,
    normalizeThinkingLevel,
    THINKING_LEVEL_LABELS,
    THINKING_LEVELS,
    type ThinkingLevel,
  } from "$lib/provider-model.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { cn } from "$lib/utils";

  type Props = {
    disabled?: boolean;
  };

  let { disabled = false }: Props = $props();

  let open = $state(false);

  const currentModel = $derived(
    mergeModelWithCatalog(desktopState.pendingModel, desktopState.availableModels) ??
      normalizeModel(desktopState.pendingModel),
  );
  const groupedModels = $derived(groupModelsByProvider(desktopState.availableModels));
  const supportsThinking = $derived(modelSupportsThinking(currentModel, desktopState.availableModels));
  const currentThinkingLevel = $derived(normalizeThinkingLevel(desktopState.pendingThinkingLevel));
  const label = $derived(
    currentModel
      ? getModelLabel(currentModel)
      : desktopState.modelsLoading
        ? "Loading models"
        : "Select model",
  );
  const currentModelValue = $derived(desktopState.pendingModel ? getModelValue(desktopState.pendingModel) : "");

  $effect(() => {
    if (open) {
      void desktopState.ensureAvailableModels();
    }
  });

  async function handleSelect(modelValue: string) {
    const model = desktopState.availableModels.find((entry) => getModelValue(entry) === modelValue);

    if (!model) {
      return;
    }

    await desktopState.setProviderModel(model);
  }

  async function handleThinkingLevel(level: ThinkingLevel) {
    await desktopState.setThinkingLevel(level);
  }

  function getModelValue(model: ProviderModel) {
    return `${model.provider ?? "unknown"}:${getModelLabel(model)}:${getModelId(model) ?? ""}`;
  }
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger
    type="button"
    {disabled}
    class={cn(
      "inline-flex border-0 bg-transparent p-0 shadow-none outline-none",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    )}
    aria-label="Select model"
    title={currentModel ? getModelLabel(currentModel) : "Select model"}
  >
    <ComposerPillButton
      {label}
      {open}
      {disabled}
      variant="footer"
      maxWidthClass="max-w-[12rem]"
      ariaLabel="Select model"
    />
  </DropdownMenu.Trigger>

  <DropdownMenu.Content
    side="top"
    align="start"
    sideOffset={8}
    class="!w-auto min-w-56 max-w-72 shadow-none ring-1 ring-border/50"
  >
    <div class="max-h-[min(20rem,50vh)] overflow-y-auto py-1">
      <DropdownMenu.Group>
        <DropdownMenu.GroupHeading
          class="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          Model
        </DropdownMenu.GroupHeading>

        {#if desktopState.modelsLoading}
          <div class="px-2 py-2 text-xs text-muted-foreground">Loading models…</div>
        {:else if desktopState.modelsError}
          <DropdownMenu.Item
            class="gap-2 text-xs text-destructive"
            onSelect={() => {
              void desktopState.ensureAvailableModels(true);
            }}
          >
            Retry loading models
          </DropdownMenu.Item>
        {:else if desktopState.availableModels.length === 0}
          <div class="px-2 py-2 text-xs text-muted-foreground">No models configured in Pi.</div>
        {:else}
          <DropdownMenu.RadioGroup value={currentModelValue} onValueChange={handleSelect}>
            {#each groupedModels as group}
              <DropdownMenu.GroupHeading
                class="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {group.provider}
              </DropdownMenu.GroupHeading>
              {#each group.models as model (getModelValue(model))}
                {@const modelValue = getModelValue(model)}
                <DropdownMenu.RadioItem value={modelValue} class="gap-2 py-1.5">
                  <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">
                    {getModelLabel(model)}
                  </span>
                </DropdownMenu.RadioItem>
              {/each}
            {/each}
          </DropdownMenu.RadioGroup>
        {/if}
      </DropdownMenu.Group>

      {#if supportsThinking}
        <DropdownMenu.Separator />
        <DropdownMenu.Group>
          <DropdownMenu.GroupHeading
            class="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            Thinking levels
          </DropdownMenu.GroupHeading>
          <DropdownMenu.RadioGroup value={currentThinkingLevel} onValueChange={(level) => handleThinkingLevel(level as ThinkingLevel)}>
            {#each THINKING_LEVELS as level}
              <DropdownMenu.RadioItem value={level} class="gap-2 py-1.5">
                <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">
                  {THINKING_LEVEL_LABELS[level]}
                </span>
              </DropdownMenu.RadioItem>
            {/each}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Group>
      {/if}
    </div>
  </DropdownMenu.Content>
</DropdownMenu.Root>
