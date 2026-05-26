<script lang="ts">
  import ComposerPillButton from "$lib/components/desktop/ComposerPillButton.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { getThinkingLevelLabel, modelSupportsThinking } from "$lib/pi-model.js";

  type Props = {
    open: boolean;
    disabled?: boolean;
    anchor?: HTMLElement | null;
    onToggle: () => void;
  };

  let { open, disabled = false, anchor = $bindable(null), onToggle }: Props = $props();

  const supportsThinking = $derived(modelSupportsThinking(desktopState.sessionState?.model));
  const label = $derived(getThinkingLevelLabel(desktopState.sessionState?.thinkingLevel));
</script>

{#if supportsThinking}
  <ComposerPillButton
    bind:anchor
    {label}
    {open}
    {disabled}
    maxWidthClass="max-w-[6.5rem]"
    ariaLabel="Select thinking level"
    title="Thinking level"
    {onToggle}
  />
{/if}
