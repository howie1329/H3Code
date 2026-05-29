<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
</script>

<header class="flex h-12 shrink-0 items-center gap-2 border-b border-border/50 px-3">
  <Sidebar.Trigger aria-label="Toggle sidebar" />
  <div class="min-w-0 flex-1">
    <h1 class="truncate text-xs font-medium text-foreground">Settings</h1>
    <p class="truncate text-[11px] text-muted-foreground">Preferences, agent, and local data</p>
  </div>
</header>
