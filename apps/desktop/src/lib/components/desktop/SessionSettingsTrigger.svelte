<script lang="ts">
  import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { SESSION_SETTINGS_TRIGGER_CLASS } from "$lib/components/desktop/composer-menu.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    getModelLabel,
    getThinkingLevelLabel,
    getThinkingLevelShortLabel,
    modelSupportsThinking,
    normalizeThinkingLevel,
  } from "$lib/pi-model.js";
  import { cn } from "$lib/utils.js";

  type Props = {
    open: boolean;
    disabled?: boolean;
    anchor?: HTMLElement | null;
    onToggle: () => void;
  };

  let { open, disabled = false, anchor = $bindable(null), onToggle }: Props = $props();

  const model = $derived(desktopState.sessionState?.model);
  const modelLabel = $derived(desktopState.modelsLoading ? "Loading…" : getModelLabel(model));
  const supportsThinking = $derived(modelSupportsThinking(model, desktopState.availableModels));
  const thinkingShort = $derived(
    getThinkingLevelShortLabel(normalizeThinkingLevel(desktopState.sessionState?.thinkingLevel)),
  );
  const summaryTitle = $derived.by(() => {
    if (supportsThinking) {
      return `${modelLabel}, thinking level ${getThinkingLevelLabel(desktopState.sessionState?.thinkingLevel)}`;
    }

    return modelLabel;
  });
</script>

<button
  bind:this={anchor}
  type="button"
  class={cn(SESSION_SETTINGS_TRIGGER_CLASS, open && "bg-accent/60")}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label="Session settings"
  title={summaryTitle}
  {disabled}
  onclick={(event) => {
    event.stopPropagation();
    onToggle();
  }}
>
  <span class="flex min-w-0 items-center gap-1 truncate">
    <span class="truncate">{modelLabel}</span>
    {#if supportsThinking}
      <span class="shrink-0 text-muted-foreground/75">· {thinkingShort}</span>
    {/if}
  </span>
  <HugeiconsIcon icon={ArrowDown01Icon} class="size-2 shrink-0 opacity-35" data-icon />
</button>
