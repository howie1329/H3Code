<script lang="ts">
  import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "$lib/components/ai-elements/tool/index.js";
  import type { TranscriptToolBlock } from "$lib/components/desktop/transcript-normalize.js";
  import { getTranscriptToolLabel } from "$lib/components/desktop/transcript-tool-labels.js";

  let { tool }: { tool: TranscriptToolBlock } = $props();

  let open = $state(false);

  const label = $derived(getTranscriptToolLabel(tool.type, tool.input));
  const hasDetails = $derived(tool.input !== undefined || Boolean(tool.output) || Boolean(tool.errorText));

  $effect(() => {
    if (tool.state === "output-error") {
      open = true;
    }
  });
</script>

{#if hasDetails}
  <Tool bind:open variant="transcript" class="group">
    <ToolHeader type={label} state={tool.state} variant="transcript" />
    <ToolContent variant="transcript">
      {#if tool.input !== undefined}
        <ToolInput input={tool.input} variant="transcript" />
      {/if}
      {#if tool.errorText || tool.output}
        <ToolOutput output={tool.output} errorText={tool.errorText} variant="transcript" />
      {/if}
    </ToolContent>
  </Tool>
{:else}
  <div class="flex h-7 w-full items-center gap-2 px-1 text-xs">
    <span
      class="size-1.5 shrink-0 rounded-full {tool.state === 'input-available' || tool.state === 'input-streaming'
        ? 'animate-pulse bg-primary'
        : tool.state === 'output-error'
          ? 'bg-destructive'
          : 'bg-muted-foreground/60'}"
      aria-hidden="true"
    ></span>
    <span class="min-w-0 flex-1 truncate font-medium text-foreground">{label}</span>
  </div>
{/if}
