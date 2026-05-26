<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/utils";

  let {
    input,
    trailing,
    leading,
    status,
    showStatus = false,
    class: className = "",
  }: {
    input: Snippet;
    trailing: Snippet;
    leading?: Snippet;
    status?: Snippet;
    showStatus?: boolean;
    class?: string;
  } = $props();
</script>

<div class={cn("w-full", className)}>
  <div
    class={cn(
      "flex min-h-10 items-center gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-1.5",
      "transition-[background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
      "focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20"
    )}
  >
    {#if leading}
      <div class="flex shrink-0 items-center">
        {@render leading()}
      </div>
    {/if}

    <div class="max-h-40 min-h-6 min-w-0 flex-1 overflow-y-auto">
      {@render input()}
    </div>

    <div class="flex shrink-0 items-center gap-1">
      {@render trailing()}
    </div>
  </div>

  {#if showStatus && status}
    <div class="mt-1 flex min-w-0 items-center gap-2 px-1 text-[11px] leading-tight text-muted-foreground">
      {@render status()}
    </div>
  {/if}
</div>
