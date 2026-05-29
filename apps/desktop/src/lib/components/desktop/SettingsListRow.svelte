<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  let {
    title,
    subtitle,
    detail,
    meta,
    actions,
    class: className,
  }: {
    title: string;
    subtitle?: string;
    detail?: string;
    meta?: Snippet;
    actions?: Snippet;
    class?: string;
  } = $props();
</script>

<li
  class={cn(
    "flex flex-col gap-2 rounded-md px-2 py-2 sm:flex-row sm:items-center sm:gap-3",
    className,
  )}
>
  <div class="min-w-0 flex-1 space-y-0.5">
    <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <p class="min-w-0 truncate text-xs font-medium">{title}</p>
      {@render meta?.()}
    </div>
    {#if subtitle}
      <p class="truncate font-mono text-[10px] text-muted-foreground" title={subtitle}>{subtitle}</p>
    {/if}
    {#if detail}
      <p class="truncate font-mono text-[10px] text-muted-foreground/80" title={detail}>{detail}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex shrink-0 flex-wrap gap-1.5">
      {@render actions()}
    </div>
  {/if}
</li>
