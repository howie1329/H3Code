<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    open: boolean;
    title?: string;
    description?: string;
    loading?: boolean;
    error?: string;
    align?: "full" | { left: number; width?: number };
    ariaLabel: string;
    onRetry?: () => void;
    children: Snippet;
  };

  let {
    open,
    title,
    description,
    loading = false,
    error,
    align = "full",
    ariaLabel,
    onRetry,
    children,
  }: Props = $props();

  const positionStyle = $derived.by(() => {
    if (align === "full") {
      return "left: 0; right: 0;";
    }

    const width = align.width ?? 256;
    return `left: ${align.left}px; width: ${width}px;`;
  });
</script>

{#if open}
  <div
    class="absolute bottom-full z-20 mb-2 max-h-80 overflow-hidden rounded-lg border border-border/50 bg-popover text-popover-foreground shadow-none transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none"
    style={positionStyle}
    role="listbox"
    aria-label={ariaLabel}
    onclick={(event) => event.stopPropagation()}
  >
    {#if title}
      <div class="border-b border-border/50 px-3 py-2">
        <div class="text-xs font-medium leading-tight text-foreground">{title}</div>
        {#if description}
          <div class="mt-0.5 text-[11px] leading-tight text-muted-foreground">{description}</div>
        {/if}
      </div>
    {/if}

    {#if loading}
      <div class="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
    {:else if error}
      <div class="flex items-center justify-between gap-3 px-3 py-3 text-xs text-muted-foreground">
        <span class="min-w-0 truncate">{error}</span>
        {#if onRetry}
          <button
            type="button"
            class="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onclick={onRetry}
          >
            Retry
          </button>
        {/if}
      </div>
    {:else}
      {@render children()}
    {/if}
  </div>
{/if}
