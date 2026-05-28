<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  let {
    label,
    description,
    controlId,
    control,
    class: className,
  }: {
    label: string;
    description?: string;
    controlId?: string;
    control: Snippet;
    class?: string;
  } = $props();
</script>

<div
  class={cn(
    "flex min-h-10 flex-col gap-2 rounded-md px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
    className,
  )}
>
  <div class="min-w-0 flex-1">
    {#if controlId}
      <label for={controlId} class="text-xs font-medium leading-snug">{label}</label>
    {:else}
      <p class="text-xs font-medium leading-snug">{label}</p>
    {/if}
    {#if description}
      <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
    {/if}
  </div>
  <div class="shrink-0 sm:max-w-[min(100%,20rem)]">
    {@render control()}
  </div>
</div>
