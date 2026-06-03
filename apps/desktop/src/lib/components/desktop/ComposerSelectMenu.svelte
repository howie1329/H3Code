<script lang="ts">
  import type { Snippet } from "svelte";

  import { COMPOSER_MENU_SHELL_CLASS } from "$lib/components/desktop/composer-menu.js";
  import { cn } from "$lib/utils.js";

  type Align =
    | "full"
    | {
        mode: "absolute";
        left: number;
        width?: number;
      }
    | {
        mode: "fixed";
        anchor: HTMLElement | null;
        width?: number;
      };

  type Props = {
    open: boolean;
    title?: string;
    description?: string;
    loading?: boolean;
    error?: string;
    align?: Align;
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

  const MENU_GAP_PX = 8;
  const DEFAULT_WIDTH = 300;

  let fixedStyle = $state("");

  function updateFixedPosition(anchor: HTMLElement | null, width: number) {
    if (!anchor) {
      fixedStyle = "";
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const menuWidth = Math.min(Math.max(width, rect.width), window.innerWidth - 16);
    let left = rect.left;

    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }

    const bottom = window.innerHeight - rect.top + MENU_GAP_PX;
    fixedStyle = `left:${left}px;bottom:${bottom}px;width:${menuWidth}px;`;
  }

  $effect(() => {
    if (!open || align === "full" || align.mode !== "fixed") {
      return;
    }

    const width = align.width ?? DEFAULT_WIDTH;
    updateFixedPosition(align.anchor, width);

    const anchor = align.anchor;
    if (!anchor) {
      return;
    }

    const handleLayout = () => updateFixedPosition(anchor, width);
    window.addEventListener("resize", handleLayout);
    window.addEventListener("scroll", handleLayout, true);

    return () => {
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("scroll", handleLayout, true);
    };
  });

  const positionStyle = $derived.by(() => {
    if (align === "full") {
      return "left: 0; right: 0;";
    }

    if (align.mode === "absolute") {
      const width = align.width ?? 256;
      return `left: ${align.left}px; width: ${width}px;`;
    }

    return fixedStyle;
  });

  const positionClass = $derived(
    align !== "full" && align.mode === "fixed"
      ? "fixed z-50 max-h-[min(20rem,50vh)]"
      : align === "full"
        ? "absolute inset-x-0 bottom-full z-20 mb-2 max-h-80"
        : "absolute bottom-full z-20 mb-2 max-h-80",
  );
</script>

{#if open}
  <div
    class={cn(COMPOSER_MENU_SHELL_CLASS, positionClass)}
    style={positionStyle}
    role="listbox"
    tabindex={-1}
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
