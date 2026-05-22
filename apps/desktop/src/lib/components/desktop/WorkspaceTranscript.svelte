<script lang="ts">
  import { AiBrain02Icon, AlertCircleIcon, FolderCodeIcon, TerminalIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState, formatMessageRole, formatMessageText } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
</script>

<section class="flex min-w-0 flex-col">
  <div class="flex h-10 items-center border-b border-border/50 px-4">
    <div class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <HugeiconsIcon icon={TerminalIcon} data-icon />
      <span class="truncate font-medium text-foreground">Transcript</span>
      <span class="truncate">{desktopState.selectedSession?.name ?? desktopState.selectedSession?.firstMessage ?? "No PI session selected"}</span>
    </div>
  </div>

  <div class="flex min-h-0 flex-1 flex-col">
    <div class="min-h-0 flex-1 overflow-auto px-6 py-5">
      {#if desktopState.errorMessage}
        <div class="mb-4 flex items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          <HugeiconsIcon icon={AlertCircleIcon} data-icon />
          <span>{desktopState.errorMessage}</span>
        </div>
      {/if}

      {#if !desktopState.repoPath}
        <div class="flex min-h-full items-center justify-center py-8">
          <div class="flex w-full max-w-2xl flex-col items-center text-center">
            <div class="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
              <HugeiconsIcon icon={FolderCodeIcon} data-icon />
            </div>
            <p class="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ready for first connection</p>
            <h2 class="mt-2 text-xl font-semibold tracking-tight">Select a repo to load PI sessions.</h2>
            <p class="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">H3Code starts PI RPC in the selected folder and renders PI-owned session messages here.</p>
            <Button class="mt-5" onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
              <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
              Select repo
            </Button>
          </div>
        </div>
      {:else if desktopState.sessions.length === 0}
        <div class="flex min-h-full items-center justify-center py-8">
          <div class="flex w-full max-w-2xl flex-col items-center text-center">
            <div class="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
              <HugeiconsIcon icon={AiBrain02Icon} data-icon />
            </div>
            <p class="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No PI sessions</p>
            <h2 class="mt-2 text-xl font-semibold tracking-tight">Create a new PI-owned session.</h2>
            <p class="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">This repo has no PI sessions yet. H3Code will not create one until you ask it to.</p>
            <Button class="mt-5" onclick={() => desktopState.handleNewSession()} disabled={desktopState.piStatus.state !== "connected" || desktopState.isBusy}>
              <HugeiconsIcon icon={AiBrain02Icon} data-icon="inline-start" />
              New session
            </Button>
          </div>
        </div>
      {:else if desktopState.messages.length === 0}
        <div class="flex min-h-full items-center justify-center py-8">
          <div class="flex w-full max-w-2xl flex-col items-center text-center">
            <div class="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
              <HugeiconsIcon icon={TerminalIcon} data-icon />
            </div>
            <p class="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Empty transcript</p>
            <h2 class="mt-2 text-xl font-semibold tracking-tight">Send a prompt to PI.</h2>
          </div>
        </div>
      {:else}
        <div class="mx-auto flex max-w-3xl flex-col gap-4">
          {#each desktopState.messages as message}
            <article class="grid gap-1 border-b border-border/50 pb-4 last:border-b-0">
              <div class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{formatMessageRole(message)}</div>
              <pre class="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">{formatMessageText(message)}</pre>
            </article>
          {/each}
        </div>
      {/if}
    </div>

    <slot />
  </div>
</section>
