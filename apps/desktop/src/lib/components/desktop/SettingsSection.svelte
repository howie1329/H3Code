<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    title,
    description,
    children,
  }: {
    id: string;
    title: string;
    description?: string;
    children: Snippet;
  } = $props();
</script>

<section {id} class="scroll-mt-4 space-y-3 border-b border-border/50 pb-8 last:border-b-0" aria-labelledby="{id}-heading">
  <div class="space-y-1">
    <h2 id="{id}-heading" class="text-base font-semibold leading-tight">{title}</h2>
    {#if description}
      <p class="text-[11px] leading-snug text-muted-foreground">{description}</p>
    {/if}
  </div>
  <div class="space-y-3">
    {@render children()}
  </div>
</section>
