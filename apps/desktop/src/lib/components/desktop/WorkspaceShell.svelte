<script lang="ts">
  import { PanelRightCloseIcon, PanelRightOpenIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import AppHeader from "$lib/components/desktop/AppHeader.svelte";
  import ContextPanel from "$lib/components/desktop/ContextPanel.svelte";
  import PromptComposer from "$lib/components/desktop/PromptComposer.svelte";
  import WorkspaceTranscript from "$lib/components/desktop/WorkspaceTranscript.svelte";
  import { Button } from "$lib/components/ui/button/index.js";

  let isContextPanelOpen = $state(true);
  const toggleLabel = $derived(isContextPanelOpen ? "Hide context panel" : "Show context panel");
</script>

<AppHeader>
  {#snippet actions()}
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={toggleLabel}
      aria-pressed={isContextPanelOpen}
      title={toggleLabel}
      onclick={() => (isContextPanelOpen = !isContextPanelOpen)}
    >
      <HugeiconsIcon icon={isContextPanelOpen ? PanelRightCloseIcon : PanelRightOpenIcon} data-icon />
    </Button>
  {/snippet}
</AppHeader>

<div
  class={isContextPanelOpen
    ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_24rem]"
    : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)]"}
>
  <WorkspaceTranscript>
    <PromptComposer />
  </WorkspaceTranscript>

  {#if isContextPanelOpen}
    <ContextPanel />
  {/if}
</div>
