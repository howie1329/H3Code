<script lang="ts">
  import { page } from "$app/state";
  import {
    AddCircleIcon,
    AiBrain02Icon,
    ArrowDown01Icon,
    ArrowRight01Icon,
    Clock04Icon,
    FolderAddIcon,
    FolderCodeIcon,
    Layout02Icon,
    SearchList01Icon,
    Settings05Icon,
    WasteIcon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState, type SidebarRepo } from "$lib/desktop-state.svelte";
  import ConfirmDeleteDialog from "$lib/components/desktop/ConfirmDeleteDialog.svelte";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  const visibleSessionCount = 5;
  let repoRemovalOpen = $state(false);
  let repoRemovalTarget = $state<SidebarRepo | undefined>();
  let sessionDeletionOpen = $state(false);
  let sessionDeletionTarget = $state<{ repo: SidebarRepo; session: PiSessionSummary } | undefined>();
  let searchQuery = $state("");
  let searchOpen = $state(false);

  const navItems = [
    { label: "Workspace", href: "/workspace", icon: Layout02Icon },
    { label: "Sessions", href: "/sessions", icon: AiBrain02Icon },
    { label: "Activity", href: "/activity", icon: Clock04Icon },
  ];

  const normalizedSearch = $derived(searchQuery.trim().toLowerCase());

  function matchesSearch(...values: (string | undefined)[]) {
    if (!normalizedSearch) {
      return true;
    }

    return values.some((value) => value?.toLowerCase().includes(normalizedSearch));
  }

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

  function toggleSearch() {
    searchOpen = !searchOpen;

    if (!searchOpen) {
      searchQuery = "";
    }
  }
</script>

<Sidebar.Sidebar collapsible="icon">
  <Sidebar.Header class="gap-2 px-2 py-2">
    <div class="flex h-8 items-center justify-between gap-1">
      <a
        href="/workspace"
        class="flex min-w-0 items-center gap-2 rounded-full px-1.5 py-1 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="H3Code workspace"
      >
        <span class="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">H3</span>
        <span class="truncate text-xs font-semibold tracking-tight group-data-[collapsible=icon]:hidden">H3Code</span>
      </a>
    </div>

    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          size="sm"
          tooltipContent="Search sessions"
          class="rounded-full px-2.5 text-muted-foreground [&_svg]:size-3"
          aria-expanded={searchOpen}
          onclick={toggleSearch}
        >
          <HugeiconsIcon icon={SearchList01Icon} />
          <span>Search</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
      {#if searchOpen}
        <Sidebar.MenuItem class="group-data-[collapsible=icon]:hidden">
          <div class="px-1 pb-1">
            <Input
              bind:value={searchQuery}
              class="h-7 text-xs"
              placeholder="Filter repos or sessions…"
              aria-label="Filter repositories and sessions"
            />
          </div>
        </Sidebar.MenuItem>
      {/if}
    </Sidebar.Menu>
  </Sidebar.Header>

  <Sidebar.Separator />

  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <Sidebar.Menu aria-label="Primary">
          {#each navItems as item}
            {@const active = page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`)}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                size="sm"
                isActive={active}
                tooltipContent={item.label}
                aria-current={active ? "page" : undefined}
                class={active ? "rounded-full px-2.5 [&_svg]:size-3" : "rounded-full px-2.5 text-muted-foreground [&_svg]:size-3"}
              >
                {#snippet child({ props })}
                  <a {...props} href={item.href}>
                    <HugeiconsIcon icon={item.icon} />
                    <span>{item.label}</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>

    <Sidebar.Separator />

    <Sidebar.Group class="min-h-0 flex-1">
      <Sidebar.GroupLabel class="h-7 px-2 text-[11px] font-medium uppercase tracking-wide">Repositories</Sidebar.GroupLabel>
      <Sidebar.GroupAction
        aria-label="Add repository"
        title="Add repository"
        onclick={() => desktopState.handleSelectRepo()}
        disabled={desktopState.isBusy}
      >
        <HugeiconsIcon icon={FolderAddIcon} />
      </Sidebar.GroupAction>
      <Sidebar.GroupContent>
        <Sidebar.Menu aria-label="Repositories">
          {#if desktopState.repos.length === 0}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                size="sm"
                tooltipContent="Add a repository"
                class="rounded-full px-2.5 text-muted-foreground [&_svg]:size-3"
                aria-disabled={desktopState.isBusy}
                onclick={() => !desktopState.isBusy && desktopState.handleSelectRepo()}
              >
                <HugeiconsIcon icon={FolderCodeIcon} />
                <span>Add a repository</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {:else}
            {#each desktopState.repos as repo}
              {@const sessionCount = repo.sessions?.length ?? 0}
              {@const repoMatches = matchesSearch(repo.name, repo.path)}
              {@const filteredSessions = (repo.sessions ?? []).filter((session) =>
                matchesSearch(session.name, session.firstMessage, session.id, repo.name)
              )}
              {@const isRepoActive = repo.path === desktopState.repoPath}
              {@const sessionLimit = repo.showAllSessions ? filteredSessions.length : visibleSessionCount}
              {@const visibleSessions = filteredSessions.slice(0, sessionLimit)}
              {@const hiddenSessionCount = Math.max(filteredSessions.length - sessionLimit, 0)}
              {#if repoMatches || filteredSessions.length > 0 || !normalizedSearch}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton
                    size="sm"
                    isActive={isRepoActive}
                    tooltipContent={repo.path}
                    aria-expanded={repo.expanded ? "true" : "false"}
                    class="h-7 rounded-full px-2.5 [&_svg]:size-3"
                    aria-disabled={desktopState.isBusy}
                    onclick={() => !desktopState.isBusy && desktopState.toggleRepo(repo.path)}
                  >
                    {#if repo.expanded}
                      <HugeiconsIcon icon={ArrowDown01Icon} class="shrink-0 text-muted-foreground" />
                    {:else}
                      <HugeiconsIcon icon={ArrowRight01Icon} class="shrink-0 text-muted-foreground" />
                    {/if}
                    <HugeiconsIcon icon={FolderCodeIcon} />
                    <span class="min-w-0 flex-1 truncate font-medium">{repo.name}</span>
                    {#if sessionCount > 0 && !repo.expanded}
                      <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">{sessionCount}</span>
                    {/if}
                  </Sidebar.MenuButton>
                  <Sidebar.MenuAction
                    showOnHover
                    aria-label={`Remove ${repo.name} from startup`}
                    title="Remove from startup"
                    disabled={desktopState.isBusy}
                    class="text-muted-foreground hover:text-destructive"
                    onclick={(event) => handleRepoRemoveClick(event, repo)}
                  >
                    <HugeiconsIcon icon={WasteIcon} />
                  </Sidebar.MenuAction>

                  {#if repo.expanded}
                    <Sidebar.MenuSub class="overflow-hidden transition-[height,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none">
                      {#if repo.sessionsLoading}
                        <Sidebar.MenuSubItem>
                          <div class="flex h-7 items-center gap-2 px-2 text-xs text-muted-foreground">
                            <span class="size-1.5 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden="true"></span>
                            <span class="truncate">Loading sessions</span>
                          </div>
                        </Sidebar.MenuSubItem>
                      {:else if repo.sessionsError}
                        <Sidebar.MenuSubItem>
                          <div class="px-2 py-1 text-xs leading-5 text-muted-foreground">Could not load sessions</div>
                        </Sidebar.MenuSubItem>
                      {:else if visibleSessions.length === 0}
                        <Sidebar.MenuSubItem>
                          <div class="px-2 py-1 text-xs leading-5 text-muted-foreground">
                            {normalizedSearch ? "No matching sessions" : "No sessions"}
                          </div>
                        </Sidebar.MenuSubItem>
                        <Sidebar.MenuSubItem>
                          <Sidebar.MenuSubButton aria-disabled={desktopState.isBusy} class="h-7 w-full max-w-full rounded-full px-2.5 text-muted-foreground">
                            {#snippet child({ props })}
                              <button {...props} type="button" disabled={desktopState.isBusy} onclick={() => desktopState.handleNewSession(repo.path)}>
                                <HugeiconsIcon icon={AddCircleIcon} />
                                <span class="truncate">New session</span>
                              </button>
                            {/snippet}
                          </Sidebar.MenuSubButton>
                        </Sidebar.MenuSubItem>
                      {:else}
                        {#each visibleSessions as session}
                          {@const isSessionActive = session.path === desktopState.selectedSessionPath}
                          {@const sessionLabel = session.name ?? (session.firstMessage || "Untitled session")}
                          <Sidebar.MenuSubItem class="group/menu-sub-item">
                            <Sidebar.MenuSubButton
                              isActive={isSessionActive}
                              aria-disabled={desktopState.isBusy}
                              class={isSessionActive
                                ? "h-auto min-h-7 w-full max-w-full rounded-full py-1.5 pr-8 font-medium"
                                : "h-auto min-h-7 w-full max-w-full rounded-full py-1.5 pr-8 text-muted-foreground"}
                            >
                              {#snippet child({ props })}
                                <button
                                  {...props}
                                  type="button"
                                  title={sessionLabel}
                                  disabled={desktopState.isBusy}
                                  onclick={() => desktopState.handleSwitchSession(session.path, repo.path)}
                                >
                                  <HugeiconsIcon icon={AiBrain02Icon} />
                                  <span class="block min-w-0 flex-1 text-left leading-snug line-clamp-2">{sessionLabel}</span>
                                </button>
                              {/snippet}
                            </Sidebar.MenuSubButton>
                            <button
                              type="button"
                              class="absolute right-1 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground opacity-100 outline-none transition-colors hover:bg-sidebar-accent hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 sm:opacity-0 sm:group-hover/menu-sub-item:opacity-100 sm:group-focus-within/menu-sub-item:opacity-100"
                              aria-label={`Delete ${sessionLabel}`}
                              title="Delete PI session"
                              disabled={desktopState.isBusy}
                              onclick={(event) => handleSessionDeleteClick(event, repo, session)}
                            >
                              <HugeiconsIcon icon={WasteIcon} class="size-3" />
                            </button>
                          </Sidebar.MenuSubItem>
                        {/each}

                        {#if hiddenSessionCount > 0}
                          <Sidebar.MenuSubItem>
                            <Sidebar.MenuSubButton class="h-7 w-full max-w-full rounded-full px-2.5 text-foreground/70">
                              {#snippet child({ props })}
                                <button
                                  {...props}
                                  type="button"
                                  aria-label={`Show ${hiddenSessionCount} more sessions for ${repo.name}`}
                                  onclick={() => desktopState.showAllRepoSessions(repo.path)}
                                >
                                  <span class="font-mono">···</span>
                                  <span class="truncate">{hiddenSessionCount} more</span>
                                </button>
                              {/snippet}
                            </Sidebar.MenuSubButton>
                          </Sidebar.MenuSubItem>
                        {/if}

                        <Sidebar.MenuSubItem>
                          <Sidebar.MenuSubButton aria-disabled={desktopState.isBusy} class="h-7 w-full max-w-full rounded-full px-2.5 text-muted-foreground">
                            {#snippet child({ props })}
                              <button {...props} type="button" disabled={desktopState.isBusy} onclick={() => desktopState.handleNewSession(repo.path)}>
                                <HugeiconsIcon icon={AddCircleIcon} />
                                <span class="truncate">New session</span>
                              </button>
                            {/snippet}
                          </Sidebar.MenuSubButton>
                        </Sidebar.MenuSubItem>
                      {/if}
                    </Sidebar.MenuSub>
                  {/if}
                </Sidebar.MenuItem>
              {/if}
            {/each}
          {/if}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>

  <Sidebar.Footer class="border-t border-sidebar-border px-2 py-2">
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="sm" tooltipContent="Settings" class="rounded-full px-2.5 text-muted-foreground [&_svg]:size-3" isActive={page.url.pathname === "/settings"}>
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
  description={`This deletes ${sessionDeletionTarget?.session.name ?? sessionDeletionTarget?.session.firstMessage ?? "this session"} from PI. This cannot be undone.`}
  confirmLabel="Delete session"
  busy={desktopState.isBusy}
  onConfirm={async () => {
    if (sessionDeletionTarget) {
      await desktopState.deleteSession(sessionDeletionTarget.session.path, sessionDeletionTarget.repo.path);
      sessionDeletionTarget = undefined;
    }
  }}
/>
