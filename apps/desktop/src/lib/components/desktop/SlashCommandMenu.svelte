<script lang="ts">
  import { getCommandLocation } from "$lib/slash-commands";

  type Props = {
    commands: PiSlashCommand[];
    loading: boolean;
    error?: string;
    highlightedIndex: number;
    unavailable?: boolean;
    onSelect: (command: PiSlashCommand) => void;
    onHighlight: (index: number) => void;
    onRetry: () => void;
  };

  let { commands, loading, error, highlightedIndex, unavailable = false, onSelect, onHighlight, onRetry }: Props = $props();

  const sourceLabels: Record<PiSlashCommand["source"], string> = {
    extension: "Extensions",
    prompt: "Prompts",
    skill: "Skills",
  };

  let groupedCommands = $derived.by(() => {
    const groups: Array<{ source: PiSlashCommand["source"]; commands: Array<{ command: PiSlashCommand; index: number }> }> = [];

    for (const [index, command] of commands.entries()) {
      const lastGroup = groups.at(-1);

      if (lastGroup?.source === command.source) {
        lastGroup.commands.push({ command, index });
        continue;
      }

      groups.push({ source: command.source, commands: [{ command, index }] });
    }

    return groups;
  });
</script>

<div class="absolute inset-x-4 bottom-full z-20 mb-2 max-h-80 overflow-hidden rounded-lg border border-border/70 bg-popover text-popover-foreground shadow-lg" role="listbox" aria-label="Pi slash commands">
  <div class="border-b border-border/50 px-3 py-2">
    <div class="text-xs font-medium leading-tight text-foreground">Pi commands</div>
    <div class="mt-0.5 text-[11px] leading-tight text-muted-foreground">Select a command to insert it into the prompt.</div>
  </div>

  {#if unavailable}
    <div class="px-3 py-4 text-xs text-muted-foreground">Slash commands unavailable for this session.</div>
  {:else if loading}
    <div class="px-3 py-4 text-xs text-muted-foreground">Loading slash commands…</div>
  {:else if error}
    <div class="flex items-center justify-between gap-3 px-3 py-3 text-xs text-muted-foreground">
      <span>Couldn’t load commands — retry</span>
      <button type="button" class="rounded-md px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none" onclick={onRetry}>Retry</button>
    </div>
  {:else if commands.length === 0}
    <div class="px-3 py-4 text-xs text-muted-foreground">No slash commands available.</div>
  {:else}
    <div class="max-h-64 overflow-y-auto py-1">
      {#each groupedCommands as group}
        <div class="px-2 pb-1 pt-2 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground first:pt-1">
          {sourceLabels[group.source]}
        </div>

        {#each group.commands as item (`${item.command.source}:${item.command.name}`)}
          {@const location = getCommandLocation(item.command)}
          <button
            type="button"
            class={item.index === highlightedIndex
              ? "flex w-full items-start gap-2 bg-accent px-3 py-2 text-left outline-none"
              : "flex w-full items-start gap-2 px-3 py-2 text-left outline-none hover:bg-accent/70"}
            role="option"
            aria-selected={item.index === highlightedIndex}
            onmouseenter={() => onHighlight(item.index)}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => onSelect(item.command)}
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate font-mono text-xs leading-tight text-foreground">/{item.command.name}</span>
              {#if item.command.description}
                <span class="mt-1 line-clamp-2 block text-[11px] leading-snug text-muted-foreground">{item.command.description}</span>
              {/if}
            </span>
            <span class="flex shrink-0 items-center gap-1 pt-0.5 text-[10px] leading-tight text-muted-foreground">
              <span class="rounded-full border border-border/70 px-1.5 py-0.5">{item.command.source}</span>
              {#if location}
                <span class="rounded-full border border-border/70 px-1.5 py-0.5">{location}</span>
              {/if}
            </span>
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</div>
