<script lang="ts">
  import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
  } from "$lib/components/ai-elements/reasoning/index.js";
  import { Task, TaskContent, TaskTrigger } from "$lib/components/ai-elements/task/index.js";
  import TranscriptTool from "$lib/components/desktop/TranscriptTool.svelte";
  import type {
    TranscriptThinkingBlock,
    TranscriptToolBlock,
  } from "$lib/components/desktop/transcript-normalize.js";
  import { summarizeWork } from "$lib/components/desktop/transcript-tool-labels.js";
  import { cn } from "$lib/utils";

  let {
    thinking = [],
    tools = [],
    followsText = false,
    isStreamingReasoning = false,
    streamingThinkingText = "",
  }: {
    thinking?: TranscriptThinkingBlock[];
    tools?: TranscriptToolBlock[];
    followsText?: boolean;
    isStreamingReasoning?: boolean;
    streamingThinkingText?: string;
  } = $props();

  let open = $state(false);

  const summary = $derived(summarizeWork(thinking.length, tools));
  const hasRunning = $derived(
    tools.some((tool) => tool.state === "input-available" || tool.state === "input-streaming")
  );
  const hasError = $derived(tools.some((tool) => tool.state === "output-error"));
  const isActive = $derived(hasRunning || isStreamingReasoning);
  const hasContent = $derived(
    thinking.length > 0 || tools.length > 0 || isStreamingReasoning || streamingThinkingText.trim().length > 0
  );

  let wasActive = false;

  $effect(() => {
    if (isActive) {
      open = true;
      wasActive = true;
    } else if (wasActive) {
      open = hasError;
      wasActive = false;
    }
  });
</script>

{#if hasContent}
  <Task
    bind:open
    animate={false}
    class={cn("w-full", followsText && "border-t border-border/35 pt-1")}
  >
    <TaskTrigger>
      <div
        class="flex h-6 w-full items-center gap-1.5 rounded-md px-1 text-left text-[10px] text-muted-foreground outline-none transition-[background-color,color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        aria-label={`Work: ${summary}`}
      >
        {#if hasRunning || isStreamingReasoning}
          <span class="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true"></span>
        {:else if hasError}
          <span class="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true"></span>
        {:else}
          <span class="size-1 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden="true"></span>
        {/if}
        <span class="min-w-0 flex-1 truncate font-normal">{summary}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          class={cn(
            "size-2.5 shrink-0 opacity-50 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </div>
    </TaskTrigger>
    <TaskContent compact class="flex flex-col gap-1 py-1">
      {#if isStreamingReasoning}
        <Reasoning isStreaming={true} defaultOpen={true} class="mb-0">
          <ReasoningTrigger variant="transcript" />
          {#if streamingThinkingText.trim()}
            <ReasoningContent content={streamingThinkingText} class="pl-4 text-[11px]" />
          {/if}
        </Reasoning>
      {/if}
      {#each thinking as block (block.id)}
        <Reasoning defaultOpen={false} class="mb-0">
          <ReasoningTrigger variant="transcript" />
          <ReasoningContent content={block.text} class="pl-4 text-[11px]" />
        </Reasoning>
      {/each}
      {#each tools as tool (tool.id)}
        <TranscriptTool {tool} />
      {/each}
    </TaskContent>
  </Task>
{/if}
