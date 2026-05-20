<script lang="ts">
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { BubbleChatFreeIcons, FolderGitFreeIcons, PlusSignFreeIcons } from '@hugeicons/core-free-icons';
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

  $: selectedSessionId = repositoryState.selectedSession?.id;
  $: transcriptEvents = selectedSessionId
    ? (repositoryState.transcriptEventsBySessionId[selectedSessionId] ?? [])
    : [];
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
      {#if transcriptEvents.length === 0}
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
          {#each transcriptEvents as event (event.id)}
            <article
              class={`rounded-lg border p-3 text-xs leading-5 ${
                event.type === 'stderr' || event.type === 'process_exit' ? 'border-destructive/40' : 'border-border'
              } ${event.type === 'user_message' ? 'bg-primary/10' : 'bg-muted/40'}`}
            >
              <div class="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span class="capitalize">{event.type.replaceAll('_', ' ')}</span>
                <time>{formatDate(event.createdAt)}</time>
              </div>
              {#if event.content}
                <pre class="whitespace-pre-wrap break-words font-sans">{event.content}</pre>
              {:else if event.type === 'rpc_response' && event.command}
                <p>{event.command} {event.success ? 'accepted' : 'failed'}</p>
              {:else}
                <p class="text-muted-foreground">{event.type}</p>
              {/if}
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
