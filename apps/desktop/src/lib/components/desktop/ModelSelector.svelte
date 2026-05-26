<script lang="ts">
  import ComposerPillButton from "$lib/components/desktop/ComposerPillButton.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { getModelLabel } from "$lib/pi-model.js";

  type Props = {
    open: boolean;
    disabled?: boolean;
    anchor?: HTMLElement | null;
    onToggle: () => void;
  };

  let { open, disabled = false, anchor = $bindable(null), onToggle }: Props = $props();

  const label = $derived(getModelLabel(desktopState.sessionState?.model));
  const hasMultipleModels = $derived(desktopState.availableModels.length > 1);
  const isStatic = $derived(!hasMultipleModels && !desktopState.modelsLoading);

  $effect(() => {
    if (desktopState.canUseSession) {
      void desktopState.ensureAvailableModels();
    }
  });
</script>

{#if isStatic}
  <span
    class="inline-flex h-6 max-w-[9rem] shrink-0 items-center truncate px-0.5 text-[11px] leading-tight font-medium text-muted-foreground"
    title={label}
  >
    {desktopState.modelsLoading ? "Loading…" : label}
  </span>
{:else}
  <ComposerPillButton
    bind:anchor
    {label}
    {open}
    {disabled}
    ariaLabel="Select model"
    title="Select model"
    {onToggle}
  />
{/if}
