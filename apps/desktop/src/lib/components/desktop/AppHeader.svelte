<script lang="ts">
  import type { Snippet } from "svelte";

  import PiStatusIndicator from "$lib/components/desktop/PiStatusIndicator.svelte";
  import { formatGitContextChip } from "$lib/components/desktop/session-metadata.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  let { actions }: { actions?: Snippet } = $props();

  const headerTitle = $derived(desktopState.sessionTitle);
  const gitContextChip = $derived(formatGitContextChip(desktopState.sessionMetadata));

  function openContextPanel() {
    desktopState.setContextPanelOpen(true);
  }
</script>

<header class="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-3">
  <Sidebar.Trigger aria-label="Toggle sidebar" />
  <PiStatusIndicator status={desktopState.piStatus} showLabel={false} />

  <div class="flex min-w-0 flex-1 items-center gap-2">
    <p class="min-w-0 truncate text-xs font-medium text-foreground" title={headerTitle}>{headerTitle}</p>
    {#if gitContextChip}
      <button
        type="button"
        class="hidden shrink-0 truncate rounded-full border border-border/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
        title="Open session context"
        onclick={openContextPanel}
      >
        {gitContextChip}
      </button>
    {/if}
  </div>

  <div class="ml-auto flex items-center gap-1">
    {@render actions?.()}
  </div>
</header>
