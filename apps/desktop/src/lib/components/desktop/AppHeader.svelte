<script lang="ts">
  import type { Snippet } from "svelte";

  import ConnectionStatusIndicator from "$lib/components/desktop/ConnectionStatusIndicator.svelte";
  import { formatGitContextChip } from "$lib/components/desktop/session-metadata.js";
  import { WORKSPACE_COLUMN_INSET_CLASS } from "$lib/components/desktop/workspace-column.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { cn } from "$lib/utils.js";

  let { actions }: { actions?: Snippet } = $props();

  const headerTitle = $derived(desktopState.sessionTitle);
  const gitContextChip = $derived(formatGitContextChip(desktopState.sessionMetadata));
  const isRunning = $derived(
    desktopState.isAgentRunning || Boolean(desktopState.sessionSnapshot?.isStreaming),
  );

  function openContextPanel() {
    desktopState.setContextPanelOpen(true);
  }
</script>

<header
  class={cn(
    "flex h-8 shrink-0 items-center gap-2 border-b border-border/50",
    WORKSPACE_COLUMN_INSET_CLASS,
  )}
>
  <Sidebar.Trigger aria-label="Toggle sidebar" class="size-7 shrink-0" />
  <ConnectionStatusIndicator status={desktopState.connectionStatus} showLabel={false} />

  <div class="flex min-w-0 flex-1 items-center gap-2">
    {#if isRunning}
      <span
        class="size-1.5 shrink-0 rounded-full bg-primary motion-reduce:animate-none animate-pulse"
        title="Run in progress"
        aria-hidden="true"
      ></span>
    {/if}
    <p
      class="min-w-0 truncate text-[11px] font-medium leading-snug text-foreground"
      title={headerTitle}
    >
      {headerTitle}
    </p>
    {#if gitContextChip}
      <button
        type="button"
        class="hidden h-7 max-w-[12rem] shrink-0 truncate rounded-md px-2 font-mono text-[11px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex sm:items-center"
        title="Open session context"
        onclick={openContextPanel}
      >
        {gitContextChip}
      </button>
    {/if}
  </div>

  <div class="ml-auto flex items-center gap-0.5">
    {@render actions?.()}
  </div>
</header>
