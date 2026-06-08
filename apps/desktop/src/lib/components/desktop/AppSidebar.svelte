<script lang="ts">
  import type { SessionSummary } from "$lib/session-types.js";
  import type { ThinkingLevel } from "$lib/provider-model.js";
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
  import ConnectionStatusIndicator from "$lib/components/desktop/ConnectionStatusIndicator.svelte";
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
  let sessionDeletionTarget = $state<{ repo: SidebarRepo; session: SessionSummary } | undefined>();

  function requestRepoRemoval(repo: SidebarRepo) {
    repoRemovalTarget = repo;
    repoRemovalOpen = true;
  }

  function requestSessionDelete(repo: SidebarRepo, session: SessionSummary) {
    sessionDeletionTarget = { repo, session };
    sessionDeletionOpen = true;
  }

  const rowHorizontalPadding = "px-2";
  const rowButtonClass = `h-7 w-full rounded-md ${rowHorizontalPadding} text-[11px] leading-snug [&_svg]:size-3`;
  const repoRowButtonClass = `${rowButtonClass} !pr-8`;
  const sidebarInset = "px-2";
  const rowListGapClass = "gap-0.5";
  const iconActionClass =
    "grid size-7 shrink-0 place-items-center rounded-md text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3";
  const contextMenuContentClass = "w-44";
  const themeToggleLabel = $derived(mode.current === "dark" ? "Switch to light mode" : "Switch to dark mode");

  async function openNewSessionLanding(repoPath?: string) {
    await desktopState.enterLanding(repoPath ? { repoPath } : {});
  }

  function handleSessionClick(sessionPath: string, repoPath: string) {
    if (page.url.pathname !== "/workspace") {
      void goto("/workspace");
    }

    void desktopState.handleSwitchSession(sessionPath, repoPath);
  }

  function openCommandMenu() {
    commandMenuController.open = true;
  }
</script>

<Sidebar.Sidebar collapsible="offcanvas">
  <Sidebar.Header class="shrink-0 border-b border-sidebar-border/50 p-0 {sidebarInset} py-1.5">
    <div class="flex h-7 items-center gap-0.5">
      <button
        type="button"
        aria-label="Open command center"
        title="Command center (⌘K)"
        class={iconActionClass}
        onclick={openCommandMenu}
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="New session"
        title="New session (⌘N)"
        disabled={desktopState.isBusy}
        class={iconActionClass}
        onclick={() => !desktopState.isBusy && openNewSessionLanding()}
      >
        <HugeiconsIcon icon={Add01Icon} />
      </button>
      <button
        type="button"
        aria-label="Add repository"
        title="Add repository"
        disabled={desktopState.isBusy}
        class={iconActionClass}
        onclick={() => desktopState.handleSelectRepo()}
      >
        <HugeiconsIcon icon={FolderAddIcon} />
      </button>
    </div>
  </Sidebar.Header>

  <Sidebar.Content class="min-h-0 flex-1">
    <Sidebar.Group class="flex min-h-0 flex-1 flex-col px-0 py-0">
      <div class="flex h-7 shrink-0 items-center pt-2 {sidebarInset}">
        <Sidebar.GroupLabel class="h-auto px-0 text-[11px] font-medium text-sidebar-foreground/80">
          Repositories
        </Sidebar.GroupLabel>
      </div>

      <Sidebar.GroupContent class="flex min-h-0 flex-1 flex-col">
        <nav aria-label="Workspace" class="flex min-h-0 flex-1 flex-col {sidebarInset}">
          <Sidebar.Menu
            aria-label="Repositories"
            class="min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain {rowListGapClass}"
          >
            {#if desktopState.repos.length === 0}
              <div class="flex flex-col gap-3 py-6 pr-1">
                <div class="space-y-1">
                  <p class="text-xs font-medium text-sidebar-foreground">No repositories yet</p>
                  <p class="text-[11px] leading-relaxed text-muted-foreground">
                    Add a folder on disk to browse Pi sessions and start work from here.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  class="h-7 w-full justify-start gap-2 px-2 text-[11px]"
                  disabled={desktopState.isBusy}
                  onclick={() => !desktopState.isBusy && desktopState.handleSelectRepo()}
                >
                  <HugeiconsIcon icon={FolderAddIcon} class="size-3" />
                  Add repository
                </Button>
              </div>
            {:else}
              {#each desktopState.repos as repo}
                {@const isRepoActive = repo.path === desktopState.repoPath}
                {@const repoSessions = repo.sessions ?? []}
                <Sidebar.MenuItem>
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
                        <HugeiconsIcon icon={FolderCodeIcon} class="shrink-0 text-muted-foreground/80" />
                        <span class={isRepoActive ? "min-w-0 flex-1 truncate font-medium" : "min-w-0 flex-1 truncate"}>
                          {repo.name}
                        </span>
                      </Sidebar.MenuButton>
                    </ContextMenu.Trigger>
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
                    <div class="shrink-0 pt-0.5 pl-3">
                      {#if repo.sessionsLoading}
                        <div
                          class="flex h-7 shrink-0 items-center gap-2 px-2 text-[11px] leading-snug text-muted-foreground"
                        >
                          <span
                            class="size-1.5 shrink-0 animate-pulse rounded-full bg-muted-foreground/45"
                            aria-hidden="true"
                          ></span>
                          <span class="truncate">Loading sessions</span>
                        </div>
                      {:else if repo.sessionsError}
                        <button
                          type="button"
                          class="flex h-7 w-full shrink-0 items-center rounded-md px-2 text-left text-[11px] leading-snug text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                          onclick={() => desktopState.loadRepoSessions(repo.path)}
                        >
                          Could not load sessions. Retry
                        </button>
                      {:else if repoSessions.length === 0}
                        <div class="flex flex-col gap-2 py-2 pr-1">
                          <p class="text-[11px] text-muted-foreground">No sessions in this repo yet.</p>
                          <Button
                            type="button"
                            variant="ghost"
                            class="h-7 w-full justify-start gap-2 px-2 text-[11px]"
                            disabled={desktopState.isBusy}
                            onclick={() => !desktopState.isBusy && openNewSessionLanding(repo.path)}
                          >
                            <HugeiconsIcon icon={Add01Icon} class="size-3" />
                            Start session
                          </Button>
                        </div>
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

  <Sidebar.Footer class="shrink-0 gap-1 border-t border-sidebar-border p-0 {sidebarInset} py-2">
    <div class="flex items-center justify-between gap-2 px-0.5">
      <ConnectionStatusIndicator status={desktopState.connectionStatus} class="min-w-0 text-[11px]" showLabel />
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
      await desktopState.deleteSession(sessionDeletionTarget.session.sessionRef, sessionDeletionTarget.repo.path);
      sessionDeletionTarget = undefined;
    }
  }}
/>
