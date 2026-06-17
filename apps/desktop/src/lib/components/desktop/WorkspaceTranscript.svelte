<script lang="ts">
  import { AiBrain02Icon, AlertCircleIcon, FolderCodeIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { get } from "svelte/store";
  import { tick, type Snippet } from "svelte";

  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import { backOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  import { desktopState } from "$lib/desktop-state.svelte";
  import { extractStreamingThinkingFromUiMessages } from "$lib/ui-message-transcript.js";
  import {
    Message,
    MessageContent,
    MessageResponse,
  } from "$lib/components/ai-elements/message/index.js";
  import TranscriptPhaseTail from "$lib/components/desktop/TranscriptPhaseTail.svelte";
  import TranscriptWorkBlock from "$lib/components/desktop/TranscriptWorkBlock.svelte";
  import {
    extractStreamingThinkingText,
    groupBlocksForRender,
  } from "$lib/components/desktop/transcript-normalize.js";
  import WorkspaceColumnEmpty from "$lib/components/desktop/WorkspaceColumnEmpty.svelte";
  import {
    WORKSPACE_COLUMN_INSET_CLASS,
    WORKSPACE_COLUMN_MAX_W_CLASS,
    WORKSPACE_TRANSCRIPT_ITEM_GAP,
  } from "$lib/components/desktop/workspace-column.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Kbd } from "$lib/components/ui/kbd/index.js";
  import { cn } from "$lib/utils.js";

  const TRANSCRIPT_SCROLL_END_THRESHOLD = 48;

  let { children }: { children?: Snippet } = $props();
  let transcriptScrollElement = $state<HTMLDivElement | null>(null);
  let composerOverlayElement = $state<HTMLDivElement | null>(null);
  let composerInsetPx = $state(176);
  let hasScrolledInitialTranscript = $state(false);
  let transcriptSessionKey = $state<string | undefined>();
  let transcriptPinnedToEnd = $state(true);
  let transcriptAtEnd = $state(true);
  let lastTranscriptScrollTop = 0;

  const composerScrollInsetPx = $derived(composerInsetPx + 8);

  const transcriptMessages = $derived(desktopState.transcriptViewModel.messages);
  const isThinking = $derived(desktopState.composerPhaseLine?.text === "Thinking…");
  const phaseTail = $derived.by(() => {
    const phase = desktopState.composerPhaseLine;

    if (!phase || phase.text === "Thinking…") {
      return null;
    }

    return phase;
  });
  const streamingThinkingText = $derived(
    extractStreamingThinkingText(extractStreamingThinkingFromUiMessages(desktopState.harnessMessages))
  );
  const transcriptItems = $derived([
    ...transcriptMessages.map((message) => ({ kind: "message" as const, key: message.id, message })),
    ...(isThinking ? [{ kind: "thinking" as const, key: "pi-thinking" }] : []),
    ...(phaseTail ? [{ kind: "phase" as const, key: `phase-${phaseTail.text}`, phase: phaseTail }] : []),
  ]);

  const transcriptVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => transcriptScrollElement,
    estimateSize: () => 180,
    getItemKey: (index) => transcriptItems[index]?.key ?? index,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: TRANSCRIPT_SCROLL_END_THRESHOLD,
    overscan: 6,
    gap: WORKSPACE_TRANSCRIPT_ITEM_GAP,
    useAnimationFrameWithResizeObserver: true,
  });

  const hasTranscriptMessages = $derived(
    Boolean(
      desktopState.repoPath &&
        desktopState.sessions.length > 0 &&
        (transcriptMessages.length > 0 || isThinking || phaseTail),
    ),
  );
  const shortcutModifier = $derived(desktopState.platform === "darwin" ? "⌘" : "Ctrl");

  $effect(() => {
    const nextSessionKey = desktopState.selectedSessionId;

    if (nextSessionKey !== transcriptSessionKey) {
      transcriptSessionKey = nextSessionKey;
      hasScrolledInitialTranscript = false;
      transcriptPinnedToEnd = true;
      transcriptAtEnd = true;
      lastTranscriptScrollTop = 0;
      get(transcriptVirtualizer).measure();
    }
  });

  $effect(() => {
    const overlay = composerOverlayElement;
    if (!overlay) {
      return;
    }

    const updateInset = () => {
      const nextInset = Math.ceil(overlay.getBoundingClientRect().height);
      if (nextInset === composerInsetPx) {
        return;
      }

      composerInsetPx = nextInset;

      if (
        transcriptPinnedToEnd &&
        transcriptItems.length > 0 &&
        get(transcriptVirtualizer).isAtEnd(TRANSCRIPT_SCROLL_END_THRESHOLD)
      ) {
        void tick().then(() => scrollTranscriptToEnd("auto"));
      }
    };

    updateInset();

    const observer = new ResizeObserver(updateInset);
    observer.observe(overlay);

    return () => observer.disconnect();
  });

  $effect(() => {
    const count = transcriptItems.length;
    const inset = composerScrollInsetPx;
    const pinnedToEnd = transcriptPinnedToEnd;
    get(transcriptVirtualizer).setOptions({
      count,
      paddingEnd: inset,
      scrollPaddingEnd: inset,
      anchorTo: pinnedToEnd ? "end" : "start",
      followOnAppend: pinnedToEnd,
    });

    if (!count) {
      hasScrolledInitialTranscript = false;
      return;
    }

    if (!hasScrolledInitialTranscript) {
      void tick().then(() => {
        scrollTranscriptToEnd("auto");
        hasScrolledInitialTranscript = true;
      });
    }
  });

  $effect(() => {
    const scrollElement = transcriptScrollElement;
    if (!scrollElement) {
      return;
    }

    const handleScroll = () => {
      const virtualizer = get(transcriptVirtualizer);
      const atEnd = virtualizer.isAtEnd(TRANSCRIPT_SCROLL_END_THRESHOLD);
      const scrollTop = scrollElement.scrollTop;

      transcriptAtEnd = atEnd;

      if (scrollTop < lastTranscriptScrollTop - 2) {
        transcriptPinnedToEnd = false;
      } else if (atEnd) {
        transcriptPinnedToEnd = true;
      }

      lastTranscriptScrollTop = scrollTop;
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => scrollElement.removeEventListener("scroll", handleScroll);
  });

  function messageAriaLabel(role: string) {
    if (role === "user") {
      return "Your message";
    }

    return "Pi response";
  }

  function hasTextBeforeWork(blocks: ReturnType<typeof groupBlocksForRender>, workIndex: number) {
    for (let index = 0; index < workIndex; index += 1) {
      if (blocks[index]?.kind === "text") {
        return true;
      }
    }

    return false;
  }

  function measureTranscriptItem(node: HTMLDivElement) {
    get(transcriptVirtualizer).measureElement(node);
  }

  function scrollTranscriptToEnd(behavior: ScrollBehavior = "smooth") {
    transcriptPinnedToEnd = true;
    get(transcriptVirtualizer).setOptions({
      anchorTo: "end",
      followOnAppend: true,
    });
    get(transcriptVirtualizer).scrollToEnd({ behavior });
  }
</script>

<section class="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Workspace transcript">
  <div class="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
    {#if hasTranscriptMessages}
      <div class="relative flex h-full min-h-0 flex-col overflow-hidden" role="log">
        <div
          bind:this={transcriptScrollElement}
          class={cn("min-h-0 flex-1 overflow-y-auto pt-2 pb-3", WORKSPACE_COLUMN_INSET_CLASS)}
          style={`scroll-padding-bottom: ${composerScrollInsetPx}px`}
        >
          {#if desktopState.errorMessage}
            <div
              class={cn(
                "mx-auto mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive",
                WORKSPACE_COLUMN_MAX_W_CLASS,
              )}
              role="alert"
              aria-live="assertive"
            >
              <HugeiconsIcon icon={AlertCircleIcon} data-icon />
              <span>{desktopState.errorMessage}</span>
            </div>
          {/if}

          <div
            class={cn("relative mx-auto w-full", WORKSPACE_COLUMN_MAX_W_CLASS)}
            style={`height: ${$transcriptVirtualizer.getTotalSize()}px;`}
          >
            {#each $transcriptVirtualizer.getVirtualItems() as virtualItem (virtualItem.key)}
              {@const item = transcriptItems[virtualItem.index]}
              {#if item?.kind === "message"}
                {@const message = item.message}
                {@const renderBlocks = groupBlocksForRender(message.blocks)}
                <div
                  data-index={virtualItem.index}
                  use:measureTranscriptItem
                  class="absolute top-0 left-0 w-full"
                  style={`transform: translateY(${virtualItem.start}px);`}
                >
                  <Message
                    from={message.role}
                    class="max-w-full gap-1"
                    aria-label={messageAriaLabel(message.role)}
                  >
                    <MessageContent
                      class={message.role === "user"
                        ? "ml-auto max-w-[min(36rem,78%)] rounded-md bg-accent/40 px-2.5 py-1.5"
                        : "w-full max-w-full overflow-visible"}
                    >
                      {#each renderBlocks as block, blockIndex (block.kind === "work" ? block.id : block.id)}
                        {#if block.kind === "text"}
                          {#if message.role === "user"}
                            <p class="whitespace-pre-wrap break-words text-[13px] leading-snug">{block.text}</p>
                          {:else}
                            <MessageResponse content={block.text} transcript />
                          {/if}
                        {:else if block.kind === "work"}
                          <TranscriptWorkBlock
                            thinking={block.thinking}
                            tools={block.tools}
                            followsText={hasTextBeforeWork(renderBlocks, blockIndex)}
                          />
                        {/if}
                      {/each}
                    </MessageContent>
                  </Message>
                </div>
              {:else if item?.kind === "thinking"}
                <div
                  data-index={virtualItem.index}
                  use:measureTranscriptItem
                  class="absolute top-0 left-0 w-full"
                  style={`transform: translateY(${virtualItem.start}px);`}
                >
                  <Message from="assistant" class="max-w-full gap-1" aria-label="Pi response">
                    <MessageContent class="w-full max-w-full overflow-visible">
                      <div aria-live="polite" aria-busy="true">
                        <TranscriptWorkBlock
                          isStreamingReasoning={true}
                          streamingThinkingText={streamingThinkingText}
                        />
                      </div>
                    </MessageContent>
                  </Message>
                </div>
              {:else if item?.kind === "phase"}
                <div
                  data-index={virtualItem.index}
                  use:measureTranscriptItem
                  class="absolute top-0 left-0 w-full"
                  style={`transform: translateY(${virtualItem.start}px);`}
                >
                  <TranscriptPhaseTail phase={item.phase} />
                </div>
              {/if}
            {/each}
          </div>
        </div>
        {#if !transcriptAtEnd}
          <div
            in:fly={{ duration: 300, y: 10, easing: backOut }}
            out:fly={{ duration: 200, y: 10, easing: backOut }}
            class="absolute left-[50%] translate-x-[-50%] motion-reduce:transition-none"
            style:bottom="{composerScrollInsetPx + 12}px"
          >
            <Button
              class="size-7 bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              onclick={() => scrollTranscriptToEnd("smooth")}
              size="icon-sm"
              type="button"
              variant="ghost"
              aria-label="Scroll to latest messages"
            >
              <ArrowDown class="size-3.5" />
            </Button>
          </div>
        {/if}
      </div>
    {:else}
      <div
        class={cn("h-full overflow-auto py-4", WORKSPACE_COLUMN_INSET_CLASS)}
        style={`scroll-padding-bottom: ${composerScrollInsetPx}px; padding-bottom: ${composerScrollInsetPx}px`}
      >
        <div class={cn("mx-auto flex w-full flex-col gap-4", WORKSPACE_COLUMN_MAX_W_CLASS)}>
          {#if desktopState.errorMessage}
            <div
              class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              role="alert"
              aria-live="assertive"
            >
              <HugeiconsIcon icon={AlertCircleIcon} data-icon class="mt-0.5 size-3 shrink-0" />
              <span>{desktopState.errorMessage}</span>
            </div>
          {/if}

          <div class="flex min-h-[min(100%,24rem)] flex-1 items-center justify-center py-8">
            {#if !desktopState.repoPath && desktopState.repos.length === 0}
              <WorkspaceColumnEmpty
                title="Add a repository"
                description="Choose a local folder to load Pi sessions and start work."
              >
                {#snippet actions()}
                  <Button
                    type="button"
                    class="h-7 gap-1.5 text-xs"
                    disabled={desktopState.isBusy}
                    onclick={() => desktopState.handleSelectRepo()}
                  >
                    <HugeiconsIcon icon={FolderCodeIcon} data-icon class="size-3.5" />
                    Select repository
                  </Button>
                {/snippet}
              </WorkspaceColumnEmpty>
            {:else if !desktopState.repoPath}
              <WorkspaceColumnEmpty
                title="Select a session"
                description="Expand a repository in the sidebar, then open a session or start a new one."
              />
            {:else if desktopState.connectionStatus.state !== "connected"}
              <WorkspaceColumnEmpty
                title="Connect to the agent server"
                description="Connect for this repository before sending prompts."
              >
                {#snippet actions()}
                  <Button
                    type="button"
                    class="h-7 text-xs"
                    disabled={desktopState.isBusy}
                    onclick={() => desktopState.repoPath && desktopState.connectRepo(desktopState.repoPath)}
                  >
                    Connect repository
                  </Button>
                {/snippet}
              </WorkspaceColumnEmpty>
            {:else if desktopState.sessions.length === 0}
              <WorkspaceColumnEmpty
                title="No sessions in this repository"
                description="Start a session when you are ready to work with Pi."
              >
                {#snippet actions()}
                  <Button
                    type="button"
                    class="h-7 gap-1.5 text-xs"
                    disabled={desktopState.isBusy}
                    onclick={() =>
                      desktopState.enterLanding(
                        desktopState.repoPath ? { repoPath: desktopState.repoPath } : {},
                      )}
                  >
                    <HugeiconsIcon icon={AiBrain02Icon} data-icon class="size-3.5" />
                    Start new session
                  </Button>
                {/snippet}
              </WorkspaceColumnEmpty>
            {:else if desktopState.harnessMessages.length === 0}
              <WorkspaceColumnEmpty
                title="Transcript is empty"
                description="Send a prompt from the composer below."
              >
                {#snippet actions()}
                  <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span class="inline-flex items-center gap-1"><Kbd>Enter</Kbd> send</span>
                    <span class="inline-flex items-center gap-1"><Kbd>/</Kbd> commands</span>
                    <span class="inline-flex items-center gap-1"
                      ><Kbd>{shortcutModifier}</Kbd><Kbd>L</Kbd> focus composer</span
                    >
                  </div>
                {/snippet}
              </WorkspaceColumnEmpty>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="absolute inset-x-0 bottom-0 z-10" bind:this={composerOverlayElement}>
    {@render children?.()}
  </div>
</section>
