<script lang="ts">
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { BubbleChatFreeIcons, FolderGitFreeIcons, PlusSignFreeIcons } from '@hugeicons/core-free-icons';
  import { dev } from '$app/environment';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Empty from '$lib/components/ui/empty';
  import {
    openCreateSession,
    repositoryState,
    sendPrompt,
    stopSelectedSession
  } from '$lib/state/repositories.svelte';

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));

  function deriveTranscriptBlocks(events: TranscriptEvent[]) {
    const blocks: TranscriptBlock[] = [];
    const blockIndexes = new Map<string, number>();

    for (const event of events) {
      const index = blockIndexes.get(event.blockId);

      if (index === undefined) {
        blockIndexes.set(event.blockId, blocks.length);
        blocks.push({
          id: event.blockId,
          kind: event.kind,
          title: event.title,
          content: event.content,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
          isFinal: event.mode === 'final'
        });
        continue;
      }

      const existing = blocks[index];
      blocks[index] = {
        ...existing,
        title: event.title || existing.title,
        content: event.mode === 'append' ? `${existing.content}${event.content}` : event.content,
        updatedAt: event.createdAt,
        isFinal: event.mode === 'final' ? true : existing.isFinal
      };
    }

    return blocks;
  }

  $: selectedSessionId = repositoryState.selectedSession?.id ?? '';
  $: transcriptEvents = selectedSessionId
    ? (repositoryState.transcriptEventsBySessionId[selectedSessionId] ?? [])
    : [];
  $: transcriptBlocks = deriveTranscriptBlocks(transcriptEvents);
  $: isLoadingSelectedTranscript = repositoryState.loadingTranscriptSessionId === selectedSessionId;
  $: canSendPrompt =
    !!repositoryState.selectedRepo &&
    !!repositoryState.selectedSession &&
    repositoryState.promptInput.trim().length > 0 &&
    !repositoryState.isSendingPrompt;
</script>

<svelte:head>
  <title>H3 Code</title>
</svelte:head>

<main class="flex min-h-svh min-w-0 flex-col bg-background text-foreground">
  {#if repositoryState.isLoadingRepos}
    <section class="flex flex-1 items-center justify-center p-6">
      <Empty.Root>
        <Empty.Header>
          <Empty.Media variant="icon">
            <HugeiconsIcon icon={FolderGitFreeIcons} size={18} color="currentColor" />
          </Empty.Media>
          <Empty.Title>Loading workspace</Empty.Title>
          <Empty.Description>Restoring your repositories and sessions.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    </section>
  {:else if !repositoryState.selectedRepo}
    <section class="flex flex-1 items-center justify-center p-6">
      <Empty.Root>
        <Empty.Header>
          <Empty.Media variant="icon">
            <HugeiconsIcon icon={FolderGitFreeIcons} size={18} color="currentColor" />
          </Empty.Media>
          <Empty.Title>No repository selected</Empty.Title>
          <Empty.Description>Add a local repository from the sidebar to create Pi sessions.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    </section>
  {:else if !repositoryState.selectedSession}
    <section class="flex flex-1 items-center justify-center p-6">
      <Empty.Root>
        <Empty.Header>
          <Empty.Media variant="icon">
            <HugeiconsIcon icon={BubbleChatFreeIcons} size={18} color="currentColor" />
          </Empty.Media>
          <Empty.Title>No sessions yet</Empty.Title>
          <Empty.Description>
            Create a Pi session scoped to {repositoryState.selectedRepo.name}.
          </Empty.Description>
        </Empty.Header>
        <Empty.Content>
          <Button class="h-8 px-3 text-xs" onclick={openCreateSession}>
            <HugeiconsIcon icon={PlusSignFreeIcons} size={12} color="currentColor" />
            Create session
          </Button>
        </Empty.Content>
      </Empty.Root>
    </section>
  {:else}
    <header class="flex h-12 items-center justify-between gap-4 border-b border-border/50 px-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span class="truncate">{repositoryState.selectedRepo.name}</span>
          <span aria-hidden="true">/</span>
          <span class="truncate">{repositoryState.selectedSession.harness}</span>
        </div>
        <h1 class="truncate text-xl font-semibold leading-tight">{repositoryState.selectedSession.title}</h1>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        {#if repositoryState.selectedSession.status === 'running'}
          <Button class="h-8 px-3 text-xs" variant="outline" onclick={stopSelectedSession} disabled={repositoryState.isStoppingSession}>
            {repositoryState.isStoppingSession ? 'Stopping...' : 'Stop'}
          </Button>
        {/if}
        <div class="rounded-full border border-border px-2.5 py-1 text-[11px] capitalize text-muted-foreground">
          {repositoryState.selectedSession.status}
        </div>
      </div>
    </header>

    <section class="grid gap-4 border-b border-border/50 p-4 text-xs md:grid-cols-2 xl:grid-cols-4">
      <div class="min-w-0 space-y-1">
        <div class="text-[11px] text-muted-foreground">Repository</div>
        <div class="truncate font-medium">{repositoryState.selectedRepo.name}</div>
        <div class="truncate text-[11px] text-muted-foreground">{repositoryState.selectedRepo.path}</div>
      </div>
      <div class="min-w-0 space-y-1">
        <div class="text-[11px] text-muted-foreground">Session ID</div>
        <div class="truncate font-mono text-[11px]">{repositoryState.selectedSession.id}</div>
      </div>
      <div class="min-w-0 space-y-1">
        <div class="text-[11px] text-muted-foreground">Created</div>
        <div>{formatDate(repositoryState.selectedSession.createdAt)}</div>
      </div>
      <div class="min-w-0 space-y-1">
        <div class="text-[11px] text-muted-foreground">Pi session path</div>
        <div class="truncate font-mono text-[11px] text-muted-foreground">
          {repositoryState.selectedSession.harnessSessionPath || 'Pending first Pi run'}
        </div>
      </div>
    </section>

    <section class="min-h-0 flex-1 overflow-y-auto p-4">
      {#if dev}
        <div class="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          session={selectedSessionId || 'none'} raw={transcriptEvents.length} blocks={transcriptBlocks.length} loading={repositoryState.loadingTranscriptSessionId || 'none'}
        </div>
      {/if}

      {#if isLoadingSelectedTranscript && transcriptBlocks.length === 0}
        <div class="flex min-h-80 items-center justify-center">
          <Empty.Root>
            <Empty.Header>
              <Empty.Media variant="icon">
                <HugeiconsIcon icon={BubbleChatFreeIcons} size={18} color="currentColor" />
              </Empty.Media>
              <Empty.Title>Loading transcript</Empty.Title>
              <Empty.Description>Restoring this Pi session transcript.</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        </div>
      {:else if transcriptBlocks.length === 0}
        <div class="flex min-h-80 items-center justify-center">
          <Empty.Root>
            <Empty.Header>
              <Empty.Media variant="icon">
                <HugeiconsIcon icon={BubbleChatFreeIcons} size={18} color="currentColor" />
              </Empty.Media>
              <Empty.Title>Empty transcript</Empty.Title>
              <Empty.Description>Send a prompt to start or resume this Pi RPC session.</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        </div>
      {:else}
        <div class="mx-auto flex max-w-4xl flex-col gap-3">
          {#each transcriptBlocks as block (block.id)}
            <article
              class={`rounded-lg border p-3 text-xs leading-5 ${
                block.kind === 'error' ? 'border-destructive/40' : 'border-border'
              } ${block.kind === 'user' ? 'bg-primary/10' : 'bg-muted/40'}`}
            >
              <div class="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span class="capitalize">{block.title || block.kind}</span>
                <time>{formatDate(block.updatedAt)}</time>
              </div>
              <pre class="whitespace-pre-wrap break-words font-sans">{block.content}</pre>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <form
      class="border-t border-border/50 p-4"
      onsubmit={(event) => {
        event.preventDefault();
        void sendPrompt();
      }}
    >
      {#if repositoryState.promptError}
        <p class="mb-2 text-xs text-destructive">{repositoryState.promptError}</p>
      {/if}
      <div class="flex gap-2">
        <Input
          class="h-9 min-w-0 flex-1 bg-background text-xs"
          placeholder="Send a prompt to Pi"
          bind:value={repositoryState.promptInput}
          disabled={repositoryState.isSendingPrompt}
        />
        <Button class="h-9" type="submit" disabled={!canSendPrompt}>
          {repositoryState.isSendingPrompt ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </form>
  {/if}
</main>
