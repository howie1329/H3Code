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
        <div class="flex min-h-full items-center justify-center px-6 py-10">
          <div class="grid w-full max-w-sm justify-items-center text-center">
            <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <HugeiconsIcon icon={FolderCodeIcon} data-icon />
            </div>
            <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No repository selected</p>
            <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Choose a repo to start.</h2>
            <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">H3Code will load PI sessions from the selected folder.</p>
            <Button class="mt-4" onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
              <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
              Select repo
            </Button>
          </div>
        </div>
      {:else if desktopState.sessions.length === 0}
        <div class="flex min-h-full items-center justify-center px-6 py-10">
          <div class="grid w-full max-w-sm justify-items-center text-center">
            <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <HugeiconsIcon icon={AiBrain02Icon} data-icon />
            </div>
            <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No sessions</p>
            <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Create a PI session.</h2>
            <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Start a session for this repository when you are ready.</p>
            <Button class="mt-4" onclick={() => desktopState.handleNewSession()} disabled={desktopState.piStatus.state !== "connected" || desktopState.isBusy}>
              <HugeiconsIcon icon={AiBrain02Icon} data-icon="inline-start" />
              New session
            </Button>
          </div>
        </div>
      {:else if desktopState.messages.length === 0}
        <div class="flex min-h-full items-center justify-center px-6 py-10">
          <div class="grid w-full max-w-sm justify-items-center text-center">
            <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <HugeiconsIcon icon={TerminalIcon} data-icon />
            </div>
            <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Empty transcript</p>
            <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Send a prompt to PI.</h2>
            <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Use the composer below to start this session.</p>
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
