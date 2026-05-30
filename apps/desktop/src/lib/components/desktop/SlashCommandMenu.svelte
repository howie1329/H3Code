<script lang="ts">
  import ComposerSelectMenu from "$lib/components/desktop/ComposerSelectMenu.svelte";
  import { COMPOSER_MENU_GROUP_LABEL_CLASS, composerMenuRowClass } from "$lib/components/desktop/composer-menu.js";
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

<ComposerSelectMenu
  open={true}
  title="Pi commands"
  description="Select a command to insert it into the prompt."
  align="full"
  ariaLabel="Pi slash commands"
  loading={loading}
  error={error ? "Couldn't load commands" : undefined}
  onRetry={onRetry}
>
  {#if unavailable}
    <div class="px-3 py-4 text-xs text-muted-foreground">Slash commands unavailable for this session.</div>
  {:else if commands.length === 0 && !loading && !error}
    <div class="px-3 py-4 text-xs text-muted-foreground">No slash commands available.</div>
  {:else}
    <div class="max-h-64 overflow-y-auto py-1">
      {#each groupedCommands as group}
        <div class={COMPOSER_MENU_GROUP_LABEL_CLASS}>{sourceLabels[group.source]}</div>

        {#each group.commands as item (`${item.command.source}:${item.command.name}`)}
          {@const location = getCommandLocation(item.command)}
          <button
            type="button"
            class={composerMenuRowClass(item.index === highlightedIndex, true)}
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
              <span class="rounded-full border border-border/50 px-1.5 py-0.5">{item.command.source}</span>
              {#if location}
                <span class="rounded-full border border-border/50 px-1.5 py-0.5">{location}</span>
              {/if}
            </span>
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</ComposerSelectMenu>
