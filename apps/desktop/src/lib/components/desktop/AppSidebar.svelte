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

  import { desktopState, formatDate } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  const navItems = [
    { label: "Workspace", href: "/workspace", icon: Layout02Icon },
    { label: "Sessions", href: "/sessions", icon: AiBrain02Icon },
    { label: "Repos", href: "/repos", icon: FolderCodeIcon },
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
        <Button variant="ghost" size="icon-sm" aria-label="New session" disabled={desktopState.piStatus.state !== "connected"} onclick={() => desktopState.handleNewSession()}>
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

    <Sidebar.Group>
      <Sidebar.GroupLabel class="h-7 px-2 text-[11px] font-medium uppercase tracking-wide">Repos</Sidebar.GroupLabel>
      <Sidebar.GroupAction aria-label="Select repo" title="Select repo" onclick={() => desktopState.handleSelectRepo()} disabled={desktopState.isBusy}>
        <HugeiconsIcon icon={AddCircleIcon} />
      </Sidebar.GroupAction>
      <Sidebar.GroupContent>
        <Sidebar.Menu aria-label="Repos">
          {#if desktopState.repos.length === 0}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton size="sm" tooltipContent="Add a repo" class="rounded-full px-2.5 text-muted-foreground [&_svg]:size-3" aria-disabled={desktopState.isBusy} onclick={() => !desktopState.isBusy && desktopState.handleSelectRepo()}>
                <HugeiconsIcon icon={FolderCodeIcon} />
                <span>Add a repo</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {:else}
            {#each desktopState.repos as repo}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton size="lg" isActive={repo.path === desktopState.repoPath} tooltipContent={repo.path} aria-pressed={repo.path === desktopState.repoPath} class="h-11" onclick={() => desktopState.connectRepo(repo.path)}>
                  <HugeiconsIcon icon={FolderCodeIcon} />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-medium">{repo.name}</span>
                    <span class="block truncate font-mono text-[10px] text-muted-foreground">{repo.path}</span>
                  </span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          {/if}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>

    {#if desktopState.repoPath}
      <Sidebar.Separator />
      <Sidebar.Group class="min-h-0 flex-1">
        <Sidebar.GroupLabel class="h-7 px-2 text-[11px] font-medium uppercase tracking-wide" title={desktopState.selectedRepo?.path ?? desktopState.repoPath}>
          {desktopState.selectedRepo?.name ?? desktopState.repoName}
        </Sidebar.GroupLabel>
        <Sidebar.GroupAction aria-label="New session" title="New session" onclick={() => desktopState.handleNewSession()} disabled={desktopState.piStatus.state !== "connected" || desktopState.isBusy}>
          <HugeiconsIcon icon={AddCircleIcon} />
        </Sidebar.GroupAction>
        <Sidebar.GroupContent>
          <Sidebar.Menu aria-label={`${desktopState.repoName} sessions`}>
            {#if desktopState.sessions.length === 0}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton size="lg" tooltipContent="No sessions" class="h-9 text-muted-foreground" aria-disabled={desktopState.piStatus.state !== "connected" || desktopState.isBusy} onclick={() => desktopState.piStatus.state === "connected" && !desktopState.isBusy && desktopState.handleNewSession()}>
                  <HugeiconsIcon icon={AiBrain02Icon} />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-medium">No sessions</span>
                    <span class="block truncate text-[10px] text-muted-foreground">Create one for this repo</span>
                  </span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {:else}
              {#each desktopState.sessions as session}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton size="lg" isActive={session.path === desktopState.selectedSessionPath} tooltipContent={session.name ?? session.firstMessage ?? session.id} aria-pressed={session.path === desktopState.selectedSessionPath} class="h-11" onclick={() => desktopState.handleSwitchSession(session.path)}>
                    <HugeiconsIcon icon={AiBrain02Icon} />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-medium">{session.name ?? (session.firstMessage || "Untitled session")}</span>
                      <span class="block truncate font-mono text-[10px] text-muted-foreground">{session.messageCount} messages · {formatDate(session.modified)}</span>
                    </span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              {/each}
            {/if}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    {/if}
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
