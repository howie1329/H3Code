<script lang="ts">
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
</script>

<header class="flex h-12 items-center gap-2 border-b border-border/50 px-3">
  <Sidebar.Trigger aria-label="Toggle sidebar" />
  <Badge variant="outline" class="shrink-0">PI {desktopState.piStatus.state}</Badge>
</header>
