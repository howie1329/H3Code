<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    description,
    controlId,
    control,
  }: {
    label: string;
    description?: string;
    controlId?: string;
    control: Snippet;
  } = $props();
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
  <div class="min-w-0 flex-1">
    {#if controlId}
      <label for={controlId} class="text-xs font-medium">{label}</label>
    {:else}
      <p class="text-xs font-medium">{label}</p>
    {/if}
    {#if description}
      <p class="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    {/if}
  </div>
  <div class="shrink-0 sm:pt-0.5">
    {@render control()}
  </div>
</div>
