<script lang="ts">
  import type { Snippet } from "svelte";

  import { desktopState } from "$lib/desktop-state.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  let { actions }: { actions?: Snippet } = $props();
</script>

<header class="flex h-12 items-center gap-2 border-b border-border/50 px-3">
  <Sidebar.Trigger aria-label="Toggle sidebar" />
  <Badge variant="outline" class="shrink-0">PI {desktopState.piStatus.state}</Badge>

  <div class="ml-auto flex items-center gap-1">
    {@render actions?.()}
  </div>
</header>
