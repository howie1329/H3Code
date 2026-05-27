<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    AddCircleIcon,
    ArrowDown01Icon,
    ArrowRight01Icon,
    FolderAddIcon,
    FolderCodeIcon,
    Settings05Icon,
    WasteIcon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState, type SidebarRepo } from "$lib/desktop-state.svelte";
  import ConfirmDeleteDialog from "$lib/components/desktop/ConfirmDeleteDialog.svelte";
  import VirtualSessionList from "$lib/components/desktop/VirtualSessionList.svelte";
  import { getSessionDisplayTitle } from "$lib/session-display-title.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  let repoRemovalOpen = $state(false);
  let repoRemovalTarget = $state<SidebarRepo | undefined>();
  let sessionDeletionOpen = $state(false);
  let sessionDeletionTarget = $state<{ repo: SidebarRepo; session: PiSessionSummary } | undefined>();

  function handleRepoRemoveClick(event: MouseEvent, repo: SidebarRepo) {
    event.preventDefault();
    event.stopPropagation();
    repoRemovalTarget = repo;
    repoRemovalOpen = true;
  }

  function handleSessionDeleteClick(event: MouseEvent, repo: SidebarRepo, session: PiSessionSummary) {
    event.preventDefault();
    event.stopPropagation();
    sessionDeletionTarget = { repo, session };
    sessionDeletionOpen = true;
  }

  const menuButtonClass =
    "h-7 rounded-full px-2.5 text-[11px] leading-snug [&_svg]:size-3 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:h-8! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:justify-center";

  async function handleNewSessionClick(repoPath: string) {
    await goto("/workspace");
    await desktopState.handleNewSession(repoPath);
  }

  async function handleSessionClick(sessionPath: string, repoPath: string) {
    await goto("/workspace");
    await desktopState.handleSwitchSession(sessionPath, repoPath);
  }
</script>

<Sidebar.Sidebar collapsible="icon">
  <Sidebar.Header class="gap-2 px-2 py-2">
    <div
      class="flex h-8 items-center justify-between gap-1 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:justify-center"
    >
      <a
        href="/workspace"
        class="flex min-w-0 flex-1 items-center gap-2 rounded-full px-1.5 py-1 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:px-0"
        aria-label="H3Code workspace"
      >
        <img src="/icons/h3code-light.svg" alt="" class="size-6 shrink-0 rounded-md dark:hidden" />
        <img src="/icons/h3code-dark.svg" alt="" class="hidden size-6 shrink-0 rounded-md dark:block" />
        <span class="truncate text-xs font-semibold tracking-tight group-data-[collapsible=icon]:hidden">H3Code</span>
      </a>
      <Sidebar.Trigger class="shrink-0 group-data-[collapsible=icon]:hidden" />
    </div>
  </Sidebar.Header>

  <Sidebar.Content class="min-h-0 flex-1">
    <Sidebar.Group class="flex min-h-0 flex-1 flex-col">
      <div
        class="flex h-7 shrink-0 items-center justify-between gap-1 px-2 group-data-[collapsible=icon]:hidden"
      >
        <span class="text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
          Repositories
        </span>
        <button
          type="button"
          aria-label="Add repository"
          title="Add repository"
          disabled={desktopState.isBusy}
          class="grid size-6 shrink-0 place-items-center rounded-md text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3"
          onclick={() => desktopState.handleSelectRepo()}
        >
          <HugeiconsIcon icon={FolderAddIcon} />
        </button>
      </div>

      <Sidebar.GroupContent class="flex min-h-0 flex-1 flex-col">
        <nav aria-label="Workspace" class="flex min-h-0 flex-1 flex-col">
          <Sidebar.Menu aria-label="Repositories" class="flex min-h-0 flex-1 flex-col">
            {#if desktopState.repos.length === 0}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  size="sm"
                  tooltipContent="Add a repository"
                  class="{menuButtonClass} text-muted-foreground"
                  aria-disabled={desktopState.isBusy}
                  onclick={() => !desktopState.isBusy && desktopState.handleSelectRepo()}
                >
                  <HugeiconsIcon icon={FolderCodeIcon} />
                  <span class="group-data-[collapsible=icon]:hidden">No repositories yet</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {:else}
              {#each desktopState.repos as repo}
                {@const sessionCount = repo.sessions?.length ?? 0}
                {@const isRepoActive = repo.path === desktopState.repoPath}
                {@const repoSessions = repo.sessions ?? []}
                <Sidebar.MenuItem class={repo.expanded ? "flex min-h-0 flex-col" : undefined}>
                  <Sidebar.MenuButton
                    size="sm"
                    isActive={isRepoActive}
                    tooltipContent={`${repo.name}${repo.path !== repo.name ? ` · ${repo.path}` : ""}`}
                    aria-expanded={repo.expanded ? "true" : "false"}
                    class={menuButtonClass}
                    aria-disabled={desktopState.isBusy}
                    onclick={() => !desktopState.isBusy && desktopState.toggleRepo(repo.path)}
                  >
                    {#if repo.expanded}
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        class="shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
                      />
                    {:else}
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        class="shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
                      />
                    {/if}
                    <HugeiconsIcon icon={FolderCodeIcon} />
                    <span
                      class="{isRepoActive
                        ? 'min-w-0 flex-1 truncate font-medium'
                        : 'min-w-0 flex-1 truncate'} group-data-[collapsible=icon]:hidden"
                    >
                      {repo.name}
                    </span>
                    {#if sessionCount > 0 && !repo.expanded}
                      <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground group-data-[collapsible=icon]:hidden">
                        {sessionCount}
                      </span>
                    {/if}
                  </Sidebar.MenuButton>
                  <Sidebar.MenuAction
                    showOnHover
                    aria-label={`Remove ${repo.name} from startup`}
                    title="Remove from startup"
                    disabled={desktopState.isBusy}
                    class="text-muted-foreground hover:text-destructive [&_svg]:size-3"
                    onclick={(event) => handleRepoRemoveClick(event, repo)}
                  >
                    <HugeiconsIcon icon={WasteIcon} />
                  </Sidebar.MenuAction>

                  {#if repo.expanded}
                    <div class="flex min-h-0 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                      <div class="px-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          class="h-7 w-full justify-start gap-2 rounded-full px-2.5 text-[11px] leading-snug text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:size-3"
                          disabled={desktopState.isBusy}
                          onclick={() => handleNewSessionClick(repo.path)}
                        >
                          <HugeiconsIcon icon={AddCircleIcon} />
                          <span>New session</span>
                        </Button>
                      </div>

                      {#if repo.sessionsLoading}
                        <Sidebar.MenuSub
                          class="max-h-[min(50svh,18rem)] min-h-0 overflow-y-auto transition-[height,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                        >
                          <Sidebar.MenuSubItem>
                            <div class="flex h-7 items-center gap-2 px-2 text-[11px] leading-snug text-muted-foreground">
                              <span class="size-1.5 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden="true"></span>
                              <span class="truncate">Loading sessions</span>
                            </div>
                          </Sidebar.MenuSubItem>
                        </Sidebar.MenuSub>
                      {:else if repo.sessionsError}
                        <Sidebar.MenuSub
                          class="max-h-[min(50svh,18rem)] min-h-0 overflow-y-auto transition-[height,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                        >
                          <Sidebar.MenuSubItem>
                            <button
                              type="button"
                              class="w-full rounded-md px-2 py-1 text-left text-[11px] leading-snug text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                              onclick={() => desktopState.loadRepoSessions(repo.path)}
                            >
                              Could not load sessions. Retry
                            </button>
                          </Sidebar.MenuSubItem>
                        </Sidebar.MenuSub>
                      {:else if repoSessions.length === 0}
                        <Sidebar.MenuSub
                          class="max-h-[min(50svh,18rem)] min-h-0 overflow-y-auto transition-[height,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                        >
                          <Sidebar.MenuSubItem>
                            <div class="px-2 py-1 text-[11px] leading-snug text-muted-foreground">No sessions in this repo</div>
                          </Sidebar.MenuSubItem>
                        </Sidebar.MenuSub>
                      {:else}
                        <VirtualSessionList
                          {repo}
                          sessions={repoSessions}
                          onSessionClick={handleSessionClick}
                          onSessionDeleteClick={handleSessionDeleteClick}
                        />
                      {/if}
                    </div>
                  {/if}
                </Sidebar.MenuItem>
              {/each}
            {/if}
          </Sidebar.Menu>
        </nav>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>

  <Sidebar.Footer class="border-t border-sidebar-border px-2 py-2">
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          size="sm"
          tooltipContent="Settings"
          class="{menuButtonClass} text-muted-foreground"
          isActive={page.url.pathname === "/settings"}
        >
          {#snippet child({ props })}
            <a {...props} href="/settings">
              <HugeiconsIcon icon={Settings05Icon} />
              <span class="group-data-[collapsible=icon]:hidden">Settings</span>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Footer>

  <Sidebar.Rail />
</Sidebar.Sidebar>

<ConfirmDeleteDialog
  bind:open={repoRemovalOpen}
  title="Remove repo from startup?"
  description={`H3Code will remove ${repoRemovalTarget?.name ?? "this repo"} from the local index. PI sessions stay on disk and can be loaded again by adding the repo.`}
  confirmLabel="Remove from startup"
  busy={desktopState.isBusy}
  onConfirm={async () => {
    if (repoRemovalTarget) {
      await desktopState.removeRepoFromIndex(repoRemovalTarget.path);
      repoRemovalTarget = undefined;
    }
  }}
/>

<ConfirmDeleteDialog
  bind:open={sessionDeletionOpen}
  title="Delete PI session?"
  description={`This deletes ${sessionDeletionTarget ? getSessionDisplayTitle(sessionDeletionTarget.session) : "this session"} from PI. This cannot be undone.`}
  confirmLabel="Delete session"
  busy={desktopState.isBusy}
  onConfirm={async () => {
    if (sessionDeletionTarget) {
      await desktopState.deleteSession(sessionDeletionTarget.session.path, sessionDeletionTarget.repo.path);
      sessionDeletionTarget = undefined;
    }
  }}
/>
