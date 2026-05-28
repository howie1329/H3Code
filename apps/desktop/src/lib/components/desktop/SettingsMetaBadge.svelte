<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<span class="inline-flex min-h-6 max-w-full items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
  <span class="truncate">{@render children()}</span>
</span>
