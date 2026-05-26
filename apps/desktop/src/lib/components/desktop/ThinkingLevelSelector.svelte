<script lang="ts">
  import ComposerPillButton from "$lib/components/desktop/ComposerPillButton.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    getThinkingLevelLabel,
    getThinkingLevelShortLabel,
    modelSupportsThinking,
    normalizeThinkingLevel,
  } from "$lib/pi-model.js";

  type Props = {
    open: boolean;
    disabled?: boolean;
    anchor?: HTMLElement | null;
    variant?: "pill" | "inline";
    onToggle: () => void;
  };

  let {
    open,
    disabled = false,
    anchor = $bindable(null),
    variant = "pill",
    onToggle,
  }: Props = $props();

  const supportsThinking = $derived(modelSupportsThinking(desktopState.sessionState?.model));
  const level = $derived(normalizeThinkingLevel(desktopState.sessionState?.thinkingLevel));
  const shortLabel = $derived(getThinkingLevelShortLabel(level));
  const fullLabel = $derived(getThinkingLevelLabel(level));
</script>

{#if supportsThinking}
  <ComposerPillButton
    bind:anchor
    label={shortLabel}
    {open}
    {disabled}
    {variant}
    maxWidthClass="max-w-[4.5rem]"
    ariaLabel={`Reasoning: ${fullLabel}`}
    title={`Reasoning: ${fullLabel}`}
    {onToggle}
  />
{/if}
