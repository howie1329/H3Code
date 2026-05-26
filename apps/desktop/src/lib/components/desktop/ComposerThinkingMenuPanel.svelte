<script lang="ts">
  import ComposerSelectMenu from "$lib/components/desktop/ComposerSelectMenu.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    normalizeThinkingLevel,
    PI_THINKING_LEVELS,
    PI_THINKING_LEVEL_LABELS,
  } from "$lib/pi-model.js";

  type Props = {
    open: boolean;
    menuLeft?: number;
    thinkingHighlightedIndex?: number;
    onSelectThinkingLevel: (level: PiThinkingLevel) => void;
    onHighlightThinking: (index: number) => void;
  };

  let {
    open,
    menuLeft = 0,
    thinkingHighlightedIndex = 0,
    onSelectThinkingLevel,
    onHighlightThinking,
  }: Props = $props();

  const currentThinkingLevel = $derived(normalizeThinkingLevel(desktopState.sessionState?.thinkingLevel));

  const rowClass = (highlighted: boolean) =>
    highlighted
      ? "flex h-7 w-full items-center gap-2 bg-accent px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      : "flex h-7 w-full items-center gap-2 px-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";
</script>

<ComposerSelectMenu
  {open}
  title="Reasoning"
  description="Extended thinking depth when the model supports it."
  align={{ left: menuLeft, width: 200 }}
  ariaLabel="Select thinking level"
>
  <div class="max-h-64 overflow-y-auto py-1">
    {#each PI_THINKING_LEVELS as level, index}
      <button
        type="button"
        class={rowClass(index === thinkingHighlightedIndex)}
        role="option"
        aria-selected={level === currentThinkingLevel}
        onmouseenter={() => onHighlightThinking(index)}
        onmousedown={(event) => event.preventDefault()}
        onclick={() => onSelectThinkingLevel(level)}
      >
        <span class="min-w-0 flex-1 truncate text-xs leading-tight text-foreground">
          {PI_THINKING_LEVEL_LABELS[level]}
        </span>
        {#if level === currentThinkingLevel}
          <span class="shrink-0 text-[10px] text-muted-foreground">Current</span>
        {/if}
      </button>
    {/each}
  </div>
</ComposerSelectMenu>
