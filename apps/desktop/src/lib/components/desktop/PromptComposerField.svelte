<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/utils";

  let {
    input,
    trailing,
    leading,
    footer,
    status,
    showStatus = false,
    layout = "inline",
    class: className = "",
  }: {
    input: Snippet;
    trailing: Snippet;
    leading?: Snippet;
    footer?: Snippet;
    status?: Snippet;
    showStatus?: boolean;
    layout?: "inline" | "stacked";
    class?: string;
  } = $props();

  const shellClass = cn(
    "rounded-lg border border-border/45 bg-background/60",
    "transition-[background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
    "focus-within:border-ring/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/15",
  );
</script>

<div class={cn("w-full", className)}>
  {#if layout === "stacked"}
    <div class={shellClass}>
      <div class="px-2.5 pt-2.5 pb-1">
        <div class="max-h-56 min-h-24 min-w-0 overflow-y-auto">
          {@render input()}
        </div>
      </div>
      <div class="flex items-center gap-2 border-t border-border/50 px-2 py-1.5">
        {#if footer}
          <div class="flex min-w-0 flex-1 items-center gap-1">
            {@render footer()}
          </div>
        {/if}
        <div class="ml-auto flex shrink-0 items-center gap-1">
          {@render trailing()}
        </div>
      </div>
    </div>
  {:else}
    <div class={cn(shellClass, "flex min-h-10 items-center gap-2 px-2.5 py-1.5")}>
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
  {/if}

  {#if showStatus && status}
    <div class="mt-1 flex min-w-0 items-center gap-2 px-1 text-[11px] leading-tight text-muted-foreground">
      {@render status()}
    </div>
  {/if}
</div>
