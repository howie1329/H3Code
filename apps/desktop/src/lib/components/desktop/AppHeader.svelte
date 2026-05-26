<script lang="ts">
  import type { Snippet } from "svelte";
  import { Moon02Icon, Sun02Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { mode, toggleMode } from "mode-watcher";

  import PiStatusIndicator from "$lib/components/desktop/PiStatusIndicator.svelte";
  import { formatGitContextChip } from "$lib/components/desktop/session-metadata.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  let { actions }: { actions?: Snippet } = $props();

  const themeToggleLabel = $derived(mode.current === "dark" ? "Switch to light mode" : "Switch to dark mode");
  const breadcrumb = $derived(
    desktopState.repoPath ? `${desktopState.repoName} · ${desktopState.sessionTitle}` : desktopState.repoName
  );
  const gitContextChip = $derived(formatGitContextChip(desktopState.sessionMetadata));

  function openContextPanel() {
    desktopState.setContextPanelOpen(true);
  }
</script>

<header class="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-3">
  <Sidebar.Trigger aria-label="Toggle sidebar" />
  <PiStatusIndicator status={desktopState.piStatus} />

  <div class="flex min-w-0 flex-1 items-center gap-2">
    <p class="min-w-0 truncate text-xs font-medium text-foreground" title={breadcrumb}>{breadcrumb}</p>
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
    <Button variant="ghost" size="icon-sm" onclick={toggleMode} aria-label={themeToggleLabel} title={themeToggleLabel}>
      <span class="relative grid size-3 place-items-center">
        <HugeiconsIcon
          icon={Sun02Icon}
          className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
        />
        <HugeiconsIcon
          icon={Moon02Icon}
          className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
        />
      </span>
    </Button>
  </div>
</header>
