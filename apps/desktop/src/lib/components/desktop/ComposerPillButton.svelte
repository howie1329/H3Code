<script lang="ts">
  import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { cn } from "$lib/utils.js";

  type Props = {
    label: string;
    open?: boolean;
    disabled?: boolean;
    anchor?: HTMLElement | null;
    ariaLabel: string;
    title?: string;
    maxWidthClass?: string;
    showChevron?: boolean;
    onToggle?: () => void;
  };

  let {
    label,
    open = false,
    disabled = false,
    anchor = $bindable(null),
    ariaLabel,
    title,
    maxWidthClass = "max-w-[9rem]",
    showChevron = true,
    onToggle,
  }: Props = $props();

  const pillClass = $derived(
    cn(
      "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] leading-tight font-medium shadow-none transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
      "border-border/50 bg-transparent text-muted-foreground",
      "hover:border-border hover:bg-accent hover:text-foreground",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      "disabled:pointer-events-none disabled:opacity-50",
      open && "border-border bg-accent text-foreground",
      maxWidthClass,
    ),
  );
</script>

{#if onToggle}
  <button
    bind:this={anchor}
    type="button"
    class={pillClass}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    {title}
    {disabled}
    onclick={(event) => {
      event.stopPropagation();
      onToggle();
    }}
  >
    <span class="truncate">{label}</span>
    {#if showChevron}
      <HugeiconsIcon icon={ArrowDown01Icon} class="size-2.5 shrink-0 opacity-60" data-icon />
    {/if}
  </button>
{:else}
  <span class={cn(pillClass, "cursor-default border-transparent bg-transparent")} {title} aria-label={ariaLabel}>
    <span class="truncate">{label}</span>
  </span>
{/if}
