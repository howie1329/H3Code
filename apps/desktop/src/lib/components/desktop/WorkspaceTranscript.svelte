<script lang="ts">
  import { AiBrain02Icon, AlertCircleIcon, FolderCodeIcon, TerminalIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { get } from "svelte/store";
  import { tick, type Snippet } from "svelte";

  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import { backOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    Message,
    MessageContent,
    MessageResponse,
  } from "$lib/components/ai-elements/message/index.js";
  import TranscriptWorkBlock from "$lib/components/desktop/TranscriptWorkBlock.svelte";
  import {
    buildTranscriptViewModel,
    extractStreamingThinkingText,
    groupBlocksForRender,
  } from "$lib/components/desktop/transcript-normalize.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
  } from "$lib/components/ui/empty/index.js";
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

  const transcriptView = $derived(buildTranscriptViewModel(desktopState.transcriptMessages));
  const transcriptMessages = $derived(transcriptView.messages);
  const isThinking = $derived(desktopState.composerPhaseLine?.text === "Thinking…");
  const streamingThinkingText = $derived(
    extractStreamingThinkingText(desktopState.sessionReadModel.streamingMessage)
  );
  const transcriptItems = $derived([
    ...transcriptMessages.map((message) => ({ kind: "message" as const, key: message.id, message })),
    ...(isThinking ? [{ kind: "thinking" as const, key: "pi-thinking" }] : []),
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
    gap: 14,
    useAnimationFrameWithResizeObserver: true,
  });

  const hasTranscriptMessages = $derived(
    Boolean(desktopState.repoPath && desktopState.sessions.length > 0 && (transcriptMessages.length > 0 || isThinking))
  );
  const shortcutModifier = $derived(desktopState.platform === "darwin" ? "⌘" : "Ctrl");

  $effect(() => {
    const nextSessionKey = desktopState.selectedSessionPath;

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
          class="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-4"
          style={`scroll-padding-bottom: ${composerScrollInsetPx}px`}
        >
          {#if desktopState.errorMessage}
            <div
              class="mx-auto mb-4 flex max-w-[46rem] items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive"
              role="alert"
              aria-live="assertive"
            >
              <HugeiconsIcon icon={AlertCircleIcon} data-icon />
              <span>{desktopState.errorMessage}</span>
            </div>
          {/if}

          <div
            class="relative mx-auto max-w-[46rem]"
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
                    class="max-w-full gap-1.5"
                    aria-label={messageAriaLabel(message.role)}
                  >
                    <MessageContent
                      class={message.role === "user"
                        ? "ml-auto max-w-[min(36rem,78%)] rounded-lg bg-accent/35 px-2.5 py-1.5"
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
                  <Message from="assistant" class="max-w-full gap-1.5" aria-label="Pi response">
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
              class={cn(
                "size-8 rounded-full border-border/50 bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-accent hover:text-foreground",
              )}
              onclick={() => scrollTranscriptToEnd("smooth")}
              size="icon"
              type="button"
              variant="outline"
              aria-label="Scroll to latest messages"
            >
              <ArrowDown class="size-4" />
            </Button>
          </div>
        {/if}
      </div>
    {:else}
      <div
        class="h-full overflow-auto px-6 py-5"
        style={`scroll-padding-bottom: ${composerScrollInsetPx}px; padding-bottom: ${composerScrollInsetPx}px`}
      >
        {#if desktopState.errorMessage}
          <div class="mb-4 flex items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive" role="alert" aria-live="assertive">
            <HugeiconsIcon icon={AlertCircleIcon} data-icon />
            <span>{desktopState.errorMessage}</span>
          </div>
        {/if}

        <div class="flex min-h-full items-center justify-center px-6 py-10">
          {#if !desktopState.repoPath && desktopState.repos.length === 0}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={FolderCodeIcon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No repository selected</p>
                <EmptyTitle>Choose a repo to start.</EmptyTitle>
                <EmptyDescription>H3Code will load Pi sessions from the selected folder.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
                  <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
                  Select repo
                </Button>
              </EmptyContent>
            </Empty>
          {:else if !desktopState.repoPath}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={AiBrain02Icon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No session selected</p>
                <EmptyTitle>Choose a session from the sidebar.</EmptyTitle>
                <EmptyDescription>Expand a repository, then open an existing session or create a new one.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          {:else if desktopState.piStatus.state !== "connected"}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={TerminalIcon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Agent offline</p>
                <EmptyTitle>Connect to continue.</EmptyTitle>
                <EmptyDescription>Connect to the local Agent Server for this repository.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onclick={() => desktopState.repoPath && desktopState.connectRepo(desktopState.repoPath)} disabled={desktopState.isBusy}>
                  Connect
                </Button>
              </EmptyContent>
            </Empty>
          {:else if desktopState.sessions.length === 0}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={AiBrain02Icon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No sessions</p>
                <EmptyTitle>Create a Pi session.</EmptyTitle>
                <EmptyDescription>Start a session for this repository when you are ready.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  onclick={() =>
                    desktopState.enterLanding(
                      desktopState.repoPath ? { repoPath: desktopState.repoPath } : {},
                    )}
                  disabled={desktopState.isBusy}
                >
                  <HugeiconsIcon icon={AiBrain02Icon} data-icon="inline-start" />
                  New session
                </Button>
              </EmptyContent>
            </Empty>
          {:else if desktopState.sessionReadModel.messages.length === 0}
            <Empty class="max-w-sm border-0 bg-transparent p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={TerminalIcon} data-icon />
                </EmptyMedia>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Empty transcript</p>
                <EmptyTitle>Ready for a prompt.</EmptyTitle>
                <EmptyDescription>Ask Pi about this repository from the composer below.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div class="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <span class="inline-flex items-center gap-1"><Kbd>Enter</Kbd> send</span>
                  <span class="inline-flex items-center gap-1"><Kbd>/</Kbd> commands</span>
                  <span class="inline-flex items-center gap-1"><Kbd>{shortcutModifier}</Kbd><Kbd>L</Kbd> focus composer</span>
                </div>
              </EmptyContent>
            </Empty>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="absolute inset-x-0 bottom-0 z-10" bind:this={composerOverlayElement}>
    {@render children?.()}
  </div>
</section>
