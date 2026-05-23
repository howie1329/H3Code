<script lang="ts">
  import { page } from "$app/state";
  import {
    AddCircleIcon,
    AiBrain02Icon,
    Clock04Icon,
    FolderCodeIcon,
    Layout02Icon,
    SearchList01Icon,
    Settings05Icon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  import { desktopState, formatDate } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  const visibleSessionCount = 5;
  const navItems = [
    { label: "Workspace", href: "/workspace", icon: Layout02Icon },
    { label: "Sessions", href: "/sessions", icon: AiBrain02Icon },
    { label: "Activity", href: "/activity", icon: Clock04Icon },
  ];
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
      <div class="flex shrink-0 items-center gap-1 group-data-[collapsible=icon]:hidden">
        <Button variant="ghost" size="icon-sm" aria-label="New session" disabled={!desktopState.repoPath || desktopState.isBusy} onclick={() => desktopState.handleNewSession()}>
          <HugeiconsIcon icon={AddCircleIcon} data-icon />
        </Button>
      </div>
    </div>

    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="sm" tooltipContent="Search" class="rounded-full px-2.5 text-muted-foreground [&_svg]:size-3">
          <HugeiconsIcon icon={SearchList01Icon} />
          <span>Search</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
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
      <Sidebar.GroupAction aria-label="Add repository" title="Add repository" onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
        <HugeiconsIcon icon={AddCircleIcon} />
      </Sidebar.GroupAction>
      <Sidebar.GroupContent>
        <Sidebar.Menu aria-label="Repositories">
          {#if desktopState.repos.length === 0}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton size="sm" tooltipContent="Add a repository" class="rounded-full px-2.5 text-muted-foreground [&_svg]:size-3" aria-disabled={desktopState.isBusy} onclick={() => !desktopState.isBusy && desktopState.handleSelectRepo()}>
                <HugeiconsIcon icon={FolderCodeIcon} />
                <span>Add a repository</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {:else}
            {#each desktopState.repos as repo}
              {@const isRepoActive = repo.path === desktopState.repoPath}
              {@const visibleSessions = (repo.sessions ?? []).slice(0, visibleSessionCount)}
              {@const hiddenSessionCount = Math.max((repo.sessions?.length ?? 0) - visibleSessionCount, 0)}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  size="lg"
                  isActive={isRepoActive}
                  tooltipContent={repo.path}
                  aria-expanded={repo.expanded ? "true" : "false"}
                  class="h-9 rounded-md px-2 [&_svg]:size-3.5"
                  onclick={() => desktopState.toggleRepo(repo.path)}
                >
                  {#if repo.expanded}
                    <ChevronDown class="size-3 shrink-0 text-muted-foreground" />
                  {:else}
                    <ChevronRight class="size-3 shrink-0 text-muted-foreground" />
                  {/if}
                  <HugeiconsIcon icon={FolderCodeIcon} />
                  <span class="min-w-0 flex-1 truncate font-medium">{repo.name}</span>
                </Sidebar.MenuButton>

                {#if repo.expanded}
                  <Sidebar.MenuSub>
                    {#if repo.sessionsLoading}
                      <Sidebar.MenuSubItem>
                        <div class="flex h-7 items-center gap-2 px-2 text-xs text-muted-foreground">
                          <span class="size-1.5 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden="true"></span>
                          <span class="truncate">Loading sessions</span>
                        </div>
                      </Sidebar.MenuSubItem>
                    {:else if repo.sessionsError}
                      <Sidebar.MenuSubItem>
                        <div class="px-2 py-1 text-xs leading-5 text-muted-foreground">
                          Could not load sessions
                        </div>
                      </Sidebar.MenuSubItem>
                    {:else if visibleSessions.length === 0}
                      <Sidebar.MenuSubItem>
                        <div class="px-2 py-1 text-xs leading-5 text-muted-foreground">No sessions</div>
                      </Sidebar.MenuSubItem>
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton aria-disabled={desktopState.isBusy} class="text-muted-foreground">
                          {#snippet child({ props })}
                            <button {...props} type="button" onclick={() => !desktopState.isBusy && desktopState.handleNewSession(repo.path)}>
                              <HugeiconsIcon icon={AddCircleIcon} />
                              <span>New session</span>
                            </button>
                          {/snippet}
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    {:else}
                      {#each visibleSessions as session}
                        {@const isSessionActive = session.path === desktopState.selectedSessionPath}
                        <Sidebar.MenuSubItem>
                          <Sidebar.MenuSubButton isActive={isSessionActive} aria-disabled={desktopState.isBusy} class={isSessionActive ? "font-medium" : "text-muted-foreground"}>
                            {#snippet child({ props })}
                              <button {...props} type="button" title={session.name ?? session.firstMessage ?? session.id} onclick={() => !desktopState.isBusy && desktopState.handleSwitchSession(session.path, repo.path)}>
                                <HugeiconsIcon icon={AiBrain02Icon} />
                                <span class="min-w-0 flex-1">
                                  <span class="block truncate">{session.name ?? (session.firstMessage || "Untitled session")}</span>
                                  <span class="block truncate font-mono text-[10px] text-muted-foreground">{session.messageCount} messages · {formatDate(session.modified)}</span>
                                </span>
                              </button>
                            {/snippet}
                          </Sidebar.MenuSubButton>
                        </Sidebar.MenuSubItem>
                      {/each}

                      {#if hiddenSessionCount > 0}
                        <Sidebar.MenuSubItem>
                          <div class="flex h-7 items-center gap-2 px-2 text-xs text-muted-foreground">
                            <span class="font-mono">···</span>
                            <span>{hiddenSessionCount} more</span>
                          </div>
                        </Sidebar.MenuSubItem>
                      {/if}

                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton aria-disabled={desktopState.isBusy} class="text-muted-foreground">
                          {#snippet child({ props })}
                            <button {...props} type="button" onclick={() => !desktopState.isBusy && desktopState.handleNewSession(repo.path)}>
                              <HugeiconsIcon icon={AddCircleIcon} />
                              <span>New session</span>
                            </button>
                          {/snippet}
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    {/if}
                  </Sidebar.MenuSub>
                {/if}
              </Sidebar.MenuItem>
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
