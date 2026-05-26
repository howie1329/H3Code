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
      "flex min-h-7 items-center gap-1 rounded-md border border-border/50 bg-transparent px-2 py-0.5",
      "transition-[border-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
      "focus-within:border-border"
    )}
  >
    {#if leading}
      <div class="flex shrink-0 items-center">
        {@render leading()}
      </div>
    {/if}

    <div class="min-h-5 min-w-0 flex-1 overflow-y-auto max-h-40">
      {@render input()}
    </div>

    <div class="flex shrink-0 items-center gap-0.5">
      {@render trailing()}
    </div>
  </div>

  {#if showStatus && status}
    <div class="mt-1 flex min-w-0 items-center gap-2 px-1 text-[11px] leading-tight text-muted-foreground">
      {@render status()}
    </div>
  {/if}
</div>
