<script lang="ts" generics="T extends string">
  import { cn } from "$lib/utils";

  type Option = {
    value: T;
    label: string;
  };

  let {
    options,
    value,
    onChange,
    disabled = false,
    ariaLabel,
    class: className,
  }: {
    options: readonly Option[];
    value: T | undefined;
    onChange: (value: T) => void;
    disabled?: boolean;
    ariaLabel: string;
    class?: string;
  } = $props();
</script>

<div
  role="radiogroup"
  aria-label={ariaLabel}
  class={cn(
    "inline-flex items-center gap-0.5 rounded-md border border-border/50 p-0.5",
    disabled && "pointer-events-none opacity-50",
    className,
  )}
>
  {#each options as option (option.value)}
    {@const selected = option.value === value}
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      {disabled}
      class={cn(
        "inline-flex h-6 items-center justify-center rounded-[calc(var(--radius-sm))] px-2.5 text-[11px] leading-none whitespace-nowrap outline-none transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-accent font-medium text-foreground"
          : "font-normal text-muted-foreground hover:text-foreground",
      )}
      onclick={() => onChange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
