<script lang="ts">
  import type { Snippet } from "svelte";

  import AppHeader from "$lib/components/desktop/AppHeader.svelte";

  let { children, actions }: { children: Snippet; actions?: Snippet } = $props();
</script>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
  <AppHeader {actions} />

  <div class="min-h-0 flex-1 overflow-hidden">
    {@render children()}
  </div>
</div>
