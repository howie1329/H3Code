<script lang="ts">
  import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import TranscriptToolRow from "$lib/components/desktop/TranscriptToolRow.svelte";
  import type { TranscriptToolBlock } from "$lib/components/desktop/transcript-normalize.js";
  import { summarizeActivity } from "$lib/components/desktop/transcript-tool-labels.js";
  import * as Collapsible from "$lib/components/ui/collapsible/index.js";
  import { cn } from "$lib/utils";

  let {
    tools,
    followsText = false,
  }: {
    tools: TranscriptToolBlock[];
    followsText?: boolean;
  } = $props();

  let open = $state(false);

  const summary = $derived(summarizeActivity(tools));
  const hasRunning = $derived(tools.some((tool) => tool.state === "input-available" || tool.state === "input-streaming"));
  const hasError = $derived(tools.some((tool) => tool.state === "output-error"));

  $effect(() => {
    if (hasError || hasRunning) {
      open = true;
    }
  });
</script>

<Collapsible.Root bind:open class={cn("w-full", followsText && "border-t border-border/50 pt-1")}>
  <Collapsible.Trigger
    class="flex h-7 w-full items-center gap-2 rounded-md px-1 text-left text-[11px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    aria-label={`Activity: ${summary}`}
  >
    {#if hasRunning}
      <span class="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true"></span>
    {:else if hasError}
      <span class="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true"></span>
    {:else}
      <span class="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true"></span>
    {/if}
    <span class="min-w-0 flex-1 truncate font-medium">{summary}</span>
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      class={cn("size-3 shrink-0 transition-transform", open && "rotate-180")}
    />
  </Collapsible.Trigger>
  <Collapsible.Content class="flex flex-col gap-0.5 py-1">
    {#each tools as tool (tool.id)}
      <TranscriptToolRow {tool} />
    {/each}
  </Collapsible.Content>
</Collapsible.Root>
