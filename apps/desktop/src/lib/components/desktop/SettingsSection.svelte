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

<section {id} class="scroll-mt-6 space-y-4" aria-labelledby="{id}-heading">
  <div>
    <h3 id="{id}-heading" class="text-base font-semibold leading-tight">{title}</h3>
    {#if description}
      <p class="mt-1 text-xs text-muted-foreground">{description}</p>
    {/if}
  </div>
  <div class="space-y-4">
    {@render children()}
  </div>
</section>
