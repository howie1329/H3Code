<script lang="ts">
  import { onMount } from "svelte";
  import { AiBrain02Icon, FolderCodeIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";

  onMount(() => {
    for (const repo of desktopState.repos) {
      if (!repo.sessionsLoaded && !repo.sessionsLoading) {
        void desktopState.loadRepoSessions(repo.path);
      }
    }
  });

  const allSessions = $derived(
    desktopState.repos.flatMap((repo) =>
      (repo.sessions ?? []).map((session) => ({
        repo,
        session,
        label: session.name ?? session.firstMessage ?? "Untitled session",
      }))
    )
  );
</script>

{#if allSessions.length === 0}
  <div class="flex min-h-full flex-col items-center justify-center px-6 py-10">
    <div class="grid w-full max-w-sm justify-items-center text-center">
      <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
        <HugeiconsIcon icon={AiBrain02Icon} data-icon />
      </div>
      <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No sessions</p>
      <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">Add a repo to browse PI sessions.</h2>
      <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Sessions from your indexed repositories appear here.</p>
      <Button class="mt-4" onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
        <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
        Add repository
      </Button>
    </div>
  </div>
{:else}
  <div class="max-w-3xl space-y-4">
    <header>
      <h2 class="text-xl font-semibold tracking-tight">Sessions</h2>
      <p class="mt-1 text-xs text-muted-foreground">All PI sessions across indexed repositories.</p>
    </header>
    <ul class="flex flex-col gap-1" role="list">
      {#each allSessions as item (item.session.path)}
        {@const isActive = item.session.path === desktopState.selectedSessionPath}
        <li>
          <button
            type="button"
            class="flex h-10 w-full items-center gap-3 rounded-full px-3 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50 {isActive ? 'bg-accent font-medium' : 'text-muted-foreground'}"
            disabled={desktopState.isBusy}
            onclick={() => desktopState.handleSwitchSession(item.session.path, item.repo.path)}
          >
            <HugeiconsIcon icon={AiBrain02Icon} data-icon />
            <span class="min-w-0 flex-1">
              <span class="block truncate">{item.label}</span>
              <span class="block truncate font-mono text-[10px] text-muted-foreground">{item.repo.name}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}
