<script lang="ts">
  import { AiBrain02Icon, AlertCircleIcon, FolderCodeIcon, TerminalIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import type { Snippet } from "svelte";

  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
  } from "$lib/components/ai-elements/conversation/index.js";
  import {
    Message,
    MessageContent,
    MessageResponse,
  } from "$lib/components/ai-elements/message/index.js";
  import TranscriptActivityGroup from "$lib/components/desktop/TranscriptActivityGroup.svelte";
  import {
    buildTranscriptViewModel,
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

  let { children }: { children?: Snippet } = $props();

  const transcriptView = $derived(buildTranscriptViewModel(desktopState.transcriptMessages));
  const transcriptMessages = $derived(transcriptView.messages);
  const isThinking = $derived(desktopState.composerPhaseLine?.text === "Thinking…");

  const hasTranscriptMessages = $derived(
    Boolean(desktopState.repoPath && desktopState.sessions.length > 0 && (transcriptMessages.length > 0 || isThinking))
  );
  const shortcutModifier = $derived(desktopState.platform === "darwin" ? "⌘" : "Ctrl");

  function messageAriaLabel(role: string) {
    if (role === "user") {
      return "Your message";
    }

    return "Pi response";
  }

  function hasTextBeforeActivity(blocks: ReturnType<typeof groupBlocksForRender>, activityIndex: number) {
    for (let index = 0; index < activityIndex; index += 1) {
      const block = blocks[index];
      if (block.kind === "text" || block.kind === "thinking") {
        return true;
      }
    }

    return false;
  }
</script>

<section class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Workspace transcript">
  <div class="min-h-0 flex-1 overflow-hidden">
    {#if hasTranscriptMessages}
      <Conversation class="h-full min-h-0">
        <ConversationContent class="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-24">
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

          <div class="mx-auto flex max-w-[46rem] flex-col gap-3.5">
            {#each transcriptMessages as message (message.id)}
              {@const renderBlocks = groupBlocksForRender(message.blocks)}
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
                  {#each renderBlocks as block, blockIndex (block.kind === "activity" ? block.id : block.id)}
                    {#if block.kind === "text"}
                      {#if message.role === "user"}
                        <p class="whitespace-pre-wrap break-words text-[13px] leading-snug">{block.text}</p>
                      {:else}
                        <MessageResponse content={block.text} transcript />
                      {/if}
                    {:else if block.kind === "thinking"}
                      <details class="py-0.5 text-xs leading-snug text-muted-foreground">
                        <summary class="cursor-pointer text-[10px] font-normal text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                          Reasoning notes
                        </summary>
                        <p class="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug">{block.text}</p>
                      </details>
                    {:else if block.kind === "activity"}
                      <TranscriptActivityGroup
                        tools={block.tools}
                        followsText={hasTextBeforeActivity(renderBlocks, blockIndex)}
                      />
                    {/if}
                  {/each}
                </MessageContent>
              </Message>
            {/each}

            {#if isThinking}
              <Message from="assistant" class="max-w-full gap-1.5" aria-label="Pi response">
                <MessageContent class="w-full max-w-full overflow-visible">
                  <div class="flex items-center gap-2 text-xs leading-snug text-muted-foreground" aria-live="polite" aria-busy="true">
                    <span class="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true"></span>
                    <span>Pi is thinking…</span>
                  </div>
                </MessageContent>
              </Message>
            {/if}
          </div>
        </ConversationContent>
        <ConversationScrollButton
          class="size-8 border-border/50 bg-background text-muted-foreground shadow-none hover:bg-accent hover:text-foreground"
        />
      </Conversation>
    {:else}
      <div class="h-full overflow-auto px-6 py-5">
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
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pi is offline</p>
                <EmptyTitle>Connect Pi to continue.</EmptyTitle>
                <EmptyDescription>Start the local Pi RPC process for this repository.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onclick={() => desktopState.repoPath && desktopState.connectRepo(desktopState.repoPath)} disabled={desktopState.isBusy}>
                  Connect Pi
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
                <Button onclick={() => desktopState.handleNewSession()} disabled={desktopState.isBusy}>
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

  <div class="shrink-0">
    {@render children?.()}
  </div>
</section>
