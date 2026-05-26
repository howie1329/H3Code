<script lang="ts">
  import type { Snippet } from "svelte";
  import { Moon02Icon, Sun02Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { mode, toggleMode } from "mode-watcher";

  import PiStatusIndicator from "$lib/components/desktop/PiStatusIndicator.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  let { actions }: { actions?: Snippet } = $props();

  const themeToggleLabel = $derived(mode.current === "dark" ? "Switch to light mode" : "Switch to dark mode");
</script>

<header class="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-3">
  <Sidebar.Trigger aria-label="Toggle sidebar" />
  <PiStatusIndicator status={desktopState.piStatus} />

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
