<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    ArrowDown01Icon,
    ArrowRight01Icon,
    Add01Icon,
    FolderAddIcon,
    FolderCodeIcon,
    Moon02Icon,
    MoreHorizontalIcon,
    Search01Icon,
    Settings05Icon,
    Sun02Icon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { mode, toggleMode } from "mode-watcher";

  import ConfirmDeleteDialog from "$lib/components/desktop/ConfirmDeleteDialog.svelte";
  import VirtualSessionList from "$lib/components/desktop/VirtualSessionList.svelte";
  import { desktopState, type SidebarRepo } from "$lib/desktop-state.svelte";
  import { commandMenuController } from "$lib/command-menu-controller.svelte.js";
  import { getSessionDisplayTitle } from "$lib/session-display-title.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as ContextMenu from "$lib/components/ui/context-menu/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  let repoRemovalOpen = $state(false);
  let repoRemovalTarget = $state<SidebarRepo | undefined>();
  let sessionDeletionOpen = $state(false);
  let sessionDeletionTarget = $state<{ repo: SidebarRepo; session: PiSessionSummary } | undefined>();

  function requestRepoRemoval(repo: SidebarRepo) {
    repoRemovalTarget = repo;
    repoRemovalOpen = true;
  }

  function requestSessionDelete(repo: SidebarRepo, session: PiSessionSummary) {
    sessionDeletionTarget = { repo, session };
    sessionDeletionOpen = true;
  }

  const rowHorizontalPadding = "px-2";
  const rowButtonClass = `h-7 w-full rounded-md ${rowHorizontalPadding} text-[11px] leading-snug [&_svg]:size-3`;
  const repoRowButtonClass = `${rowButtonClass} !pr-8`;
  const sidebarRowInset = "px-1.5";
  const menuSubClass =
    "mx-0 max-h-[min(50svh,18rem)] min-h-0 w-full translate-x-0 gap-1 overflow-y-auto border-0 px-0 py-0 transition-[height,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
  const rowListGapClass = "gap-1";
  const contextMenuContentClass = "w-44";
  const themeToggleLabel = $derived(mode.current === "dark" ? "Switch to light mode" : "Switch to dark mode");

  async function openNewSessionLanding(repoPath?: string) {
    await desktopState.enterLanding(repoPath ? { repoPath } : {});
  }

  async function handleSessionClick(sessionPath: string, repoPath: string) {
    await goto("/workspace");
    await desktopState.handleSwitchSession(sessionPath, repoPath);
  }
</script>

<Sidebar.Sidebar collapsible="offcanvas">
  <Sidebar.Content class="min-h-0 flex-1">
    <div class="flex h-10 shrink-0 items-center gap-1 border-b border-border/50 px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        aria-label="Command center"
        title="Command center"
        onclick={() => {
          commandMenuController.open = true;
        }}
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onclick={toggleMode}
        aria-label={themeToggleLabel}
        title={themeToggleLabel}
      >
        <span class="relative grid size-3 place-items-center">
          <HugeiconsIcon
            icon={Sun02Icon}
            strokeWidth={2}
            className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
          />
          <HugeiconsIcon
            icon={Moon02Icon}
            strokeWidth={2}
            className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
          />
        </span>
      </Button>
    </div>

    <Sidebar.Group class="flex min-h-0 flex-1 flex-col px-0 py-0 {sidebarRowInset}">
      <div class="flex h-7 shrink-0 items-center justify-between gap-1 pt-2 {rowHorizontalPadding}">
        <span class="text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
          Repositories
        </span>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="New session"
            title="New session"
            disabled={desktopState.isBusy}
            class="grid size-6 shrink-0 place-items-center rounded-md text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3"
            onclick={() => !desktopState.isBusy && openNewSessionLanding()}
          >
            <HugeiconsIcon icon={Add01Icon} />
          </button>
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
      </div>

      <Sidebar.GroupContent class="flex min-h-0 flex-1 flex-col">
        <nav aria-label="Workspace" class="flex min-h-0 flex-1 flex-col">
          <Sidebar.Menu aria-label="Repositories" class="flex min-h-0 flex-1 flex-col {rowListGapClass}">
            {#if desktopState.repos.length === 0}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  size="sm"
                  tooltipContent="Add a repository"
                  class="{rowButtonClass} text-muted-foreground"
                  aria-disabled={desktopState.isBusy}
                  onclick={() => !desktopState.isBusy && desktopState.handleSelectRepo()}
                >
                  <HugeiconsIcon icon={FolderCodeIcon} />
                  <span>No repositories yet</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {:else}
              {#each desktopState.repos as repo}
                {@const sessionCount = repo.sessions?.length ?? 0}
                {@const isRepoActive = repo.path === desktopState.repoPath}
                {@const repoSessions = repo.sessions ?? []}
                <Sidebar.MenuItem class={repo.expanded ? "flex min-h-0 flex-col" : undefined}>
                  <ContextMenu.Root>
                    <ContextMenu.Trigger class="w-full">
                      <Sidebar.MenuButton
                        size="sm"
                        isActive={isRepoActive}
                        tooltipContent={`${repo.name}${repo.path !== repo.name ? ` · ${repo.path}` : ""}`}
                        aria-expanded={repo.expanded ? "true" : "false"}
                        class={repoRowButtonClass}
                        aria-disabled={desktopState.isBusy}
                        onclick={() => !desktopState.isBusy && desktopState.toggleRepo(repo.path)}
                      >
                        {#if repo.expanded}
                          <HugeiconsIcon icon={ArrowDown01Icon} class="shrink-0 text-muted-foreground" />
                        {:else}
                          <HugeiconsIcon icon={ArrowRight01Icon} class="shrink-0 text-muted-foreground" />
                        {/if}
                        <HugeiconsIcon icon={FolderCodeIcon} />
                        <span class={isRepoActive ? "min-w-0 flex-1 truncate font-medium" : "min-w-0 flex-1 truncate"}>
                          {repo.name}
                        </span>
                        {#if sessionCount > 0 && !repo.expanded}
                          <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {sessionCount}
                          </span>
                        {/if}
                      </Sidebar.MenuButton>
                    </ContextMenu.Trigger>
                    <ContextMenu.Content class={contextMenuContentClass}>
                      <ContextMenu.Item
                        disabled={desktopState.isBusy}
                        onSelect={() => openNewSessionLanding(repo.path)}
                      >
                        New session
                      </ContextMenu.Item>
                      <ContextMenu.Separator />
                      <ContextMenu.Item
                        variant="destructive"
                        disabled={desktopState.isBusy}
                        onSelect={() => requestRepoRemoval(repo)}
                      >
                        Remove from startup
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Root>

                  <ContextMenu.Root>
                    <ContextMenu.Trigger>
                      <Sidebar.MenuAction
                        showOnHover
                        aria-label={`Actions for ${repo.name}`}
                        title="Repository actions"
                        disabled={desktopState.isBusy}
                        class="text-muted-foreground hover:text-sidebar-accent-foreground [&_svg]:size-3"
                      >
                        <HugeiconsIcon icon={MoreHorizontalIcon} />
                      </Sidebar.MenuAction>
                    </ContextMenu.Trigger>
                    <ContextMenu.Content class={contextMenuContentClass}>
                      <ContextMenu.Item
                        disabled={desktopState.isBusy}
                        onSelect={() => openNewSessionLanding(repo.path)}
                      >
                        New session
                      </ContextMenu.Item>
                      <ContextMenu.Separator />
                      <ContextMenu.Item
                        variant="destructive"
                        disabled={desktopState.isBusy}
                        onSelect={() => requestRepoRemoval(repo)}
                      >
                        Remove from startup
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Root>

                  {#if repo.expanded}
                    <div class="flex min-h-0 flex-col pt-1 {rowListGapClass}">
                      {#if repo.sessionsLoading}
                        <Sidebar.MenuSub class={menuSubClass}>
                          <Sidebar.MenuSubItem>
                            <div
                              class="flex h-7 w-full items-center gap-2 px-2 text-[11px] leading-snug text-muted-foreground"
                            >
                              <span
                                class="size-1.5 shrink-0 rounded-full bg-muted-foreground/45"
                                aria-hidden="true"
                              ></span>
                              <span class="truncate">Loading sessions</span>
                            </div>
                          </Sidebar.MenuSubItem>
                        </Sidebar.MenuSub>
                      {:else if repo.sessionsError}
                        <Sidebar.MenuSub class={menuSubClass}>
                          <Sidebar.MenuSubItem>
                            <button
                              type="button"
                              class="flex h-7 w-full items-center rounded-md px-2 text-left text-[11px] leading-snug text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                              onclick={() => desktopState.loadRepoSessions(repo.path)}
                            >
                              Could not load sessions. Retry
                            </button>
                          </Sidebar.MenuSubItem>
                        </Sidebar.MenuSub>
                      {:else if repoSessions.length === 0}
                        <Sidebar.MenuSub class={menuSubClass}>
                          <Sidebar.MenuSubItem>
                            <div class="flex h-7 w-full items-center px-2 text-[11px] leading-snug text-muted-foreground">
                              No sessions in this repo
                            </div>
                          </Sidebar.MenuSubItem>
                        </Sidebar.MenuSub>
                      {:else}
                        <VirtualSessionList
                          {repo}
                          sessions={repoSessions}
                          onSessionClick={handleSessionClick}
                          onSessionDeleteRequest={requestSessionDelete}
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

  <Sidebar.Footer class="border-t border-sidebar-border p-0 {sidebarRowInset} py-1">
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          size="sm"
          tooltipContent="Settings"
          class="{rowButtonClass} text-muted-foreground"
          isActive={page.url.pathname === "/settings"}
        >
          {#snippet child({ props })}
            <a {...props} href="/settings">
              <HugeiconsIcon icon={Settings05Icon} />
              <span>Settings</span>
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
