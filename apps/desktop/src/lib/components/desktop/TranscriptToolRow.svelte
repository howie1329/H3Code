<script lang="ts">
  import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import type { TranscriptToolBlock } from "$lib/components/desktop/transcript-normalize.js";
  import { formatToolValue } from "$lib/components/desktop/transcript-normalize.js";
  import { getTranscriptToolLabel } from "$lib/components/desktop/transcript-tool-labels.js";
  import * as Collapsible from "$lib/components/ui/collapsible/index.js";
  import { cn } from "$lib/utils";

  let { tool }: { tool: TranscriptToolBlock } = $props();

  let open = $state(false);

  $effect(() => {
    if (tool.state === "output-error") {
      open = true;
    }
  });

  const label = $derived(getTranscriptToolLabel(tool.type, tool.input));
  const isRunning = $derived(tool.state === "input-available" || tool.state === "input-streaming");
  const isError = $derived(tool.state === "output-error");
  const hasDetails = $derived(tool.input !== undefined || Boolean(tool.output) || Boolean(tool.errorText));

  const statusClass = $derived(
    cn(
      "size-1.5 shrink-0 rounded-full",
      isRunning && "animate-pulse bg-primary",
      isError && "bg-destructive",
      !isRunning && !isError && "bg-muted-foreground/60"
    )
  );
</script>

<Collapsible.Root bind:open class="w-full">
  {#if hasDetails}
    <Collapsible.Trigger
      class="flex h-7 w-full items-center gap-2 rounded-md px-1 text-left text-xs text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${label}, ${isRunning ? "running" : isError ? "failed" : "completed"}`}
    >
      <span class={statusClass} aria-hidden="true"></span>
      <span class="min-w-0 flex-1 truncate font-medium">{label}</span>
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        class={cn("size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
      />
    </Collapsible.Trigger>
    <Collapsible.Content class="pb-1 pl-4">
      {#if tool.input !== undefined}
        <pre class="overflow-x-auto py-1 font-mono text-[11px] leading-snug text-muted-foreground">{formatToolValue(tool.input)}</pre>
      {/if}
      {#if tool.errorText || tool.output}
        <pre
          class={tool.errorText
            ? "overflow-x-auto py-1 font-mono text-[11px] leading-snug text-destructive"
            : "overflow-x-auto py-1 font-mono text-[11px] leading-snug text-muted-foreground"}
        >{tool.errorText ?? formatToolValue(tool.output)}</pre>
      {/if}
    </Collapsible.Content>
  {:else}
    <div class="flex h-7 w-full items-center gap-2 px-1 text-xs">
      <span class={statusClass} aria-hidden="true"></span>
      <span class="min-w-0 flex-1 truncate font-medium text-foreground">{label}</span>
    </div>
  {/if}
</Collapsible.Root>
