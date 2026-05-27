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
    variant?: "pill" | "footer" | "inline";
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
    variant = "pill",
    onToggle,
  }: Props = $props();

  const pillClass = $derived(
    cn(
      "inline-flex shrink-0 items-center gap-1 shadow-none transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      "disabled:pointer-events-none disabled:opacity-50",
      variant === "inline"
        ? cn(
            "h-6 gap-1 rounded-md px-1.5 text-[10px] leading-tight font-normal text-muted-foreground",
            maxWidthClass,
            "hover:bg-accent/40 hover:text-foreground",
            open && "bg-accent/40 text-foreground"
          )
        : variant === "footer"
        ? cn(
            "h-7 max-w-[14rem] rounded-md px-1.5 text-[11px] leading-tight font-medium text-muted-foreground",
            "hover:bg-accent hover:text-foreground",
            open && "bg-accent text-foreground"
          )
        : cn(
            "h-6 rounded-full border px-2 text-[11px] leading-tight font-medium",
            "border-border/50 bg-transparent text-muted-foreground",
            "hover:border-border hover:bg-accent hover:text-foreground",
            open && "border-border bg-accent text-foreground",
            maxWidthClass
          )
    )
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
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        class="size-2.5 shrink-0 opacity-40"
        data-icon
      />
    {/if}
  </button>
{:else}
  <span class={cn(pillClass, "cursor-default border-transparent bg-transparent")} {title} aria-label={ariaLabel}>
    <span class="truncate">{label}</span>
  </span>
{/if}
