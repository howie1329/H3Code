<script lang="ts">
  import type { Snippet } from "svelte";

  import AppHeader from "$lib/components/desktop/AppHeader.svelte";

  let { children, actions }: { children: Snippet; actions?: Snippet } = $props();
</script>

<AppHeader {actions} />

<div class="min-h-0 flex-1 overflow-hidden">
  {@render children()}
</div>
