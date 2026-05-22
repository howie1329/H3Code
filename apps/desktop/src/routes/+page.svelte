<script lang="ts">
  import {
    AddCircleIcon,
    AiBrain02Icon,
    AlertCircleIcon,
    ArrowUp02Icon,
    Clock04Icon,
    FolderCodeIcon,
    GitBranchIcon,
    Layout02Icon,
    LinkSquare02Icon,
    SearchList01Icon,
    Settings05Icon,
    StopCircleIcon,
    TerminalIcon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  const platform = typeof window === "undefined" ? "desktop" : (window.h3code?.platform ?? "desktop");

  const navItems = [
    { label: "Workspace", icon: Layout02Icon, active: true },
    { label: "Sessions", icon: AiBrain02Icon },
    { label: "Repos", icon: FolderCodeIcon },
    { label: "Activity", icon: Clock04Icon },
  ];

  const recentRepos = [
    { name: "H3Code", path: "~/Desktop/H3Code", status: "selected" },
    { name: "agentkit-labs", path: "~/Code/agentkit-labs", status: "idle" },
    { name: "desktop-shell", path: "~/Code/desktop-shell", status: "idle" },
  ];

  const runtimeRows = [
    { label: "PI RPC", value: "Not connected" },
    { label: "Executable", value: "pi" },
    { label: "Working dir", value: "~/Desktop/H3Code" },
  ];

  const toolEvents = [
    { name: "get_state", state: "waiting" },
    { name: "get_messages", state: "waiting" },
    { name: "prompt", state: "idle" },
  ];
</script>

<svelte:head>
  <title>H3Code Desktop</title>
  <meta name="description" content="H3Code desktop scaffold." />
</svelte:head>

<Sidebar.Provider class="h-screen min-h-0 overflow-hidden bg-background text-foreground">
  <Sidebar.Sidebar collapsible="icon">
    <Sidebar.Header class="gap-2 px-2 py-2">
      <div class="flex h-8 items-center justify-between gap-1">
        <a
          href="/"
          class="flex min-w-0 items-center gap-2 rounded-full px-1.5 py-1 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="H3Code workspace"
        >
          <span class="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            H3
          </span>
          <span class="truncate text-xs font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            H3Code
          </span>
        </a>
        <div class="flex shrink-0 items-center gap-1 group-data-[collapsible=icon]:hidden">
          <Sidebar.Trigger aria-label="Collapse sidebar" />
          <Button variant="ghost" size="icon-sm" aria-label="New session">
            <HugeiconsIcon icon={AddCircleIcon} data-icon />
          </Button>
        </div>
      </div>

      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="sm" tooltipContent="Search workspace">
            <HugeiconsIcon icon={SearchList01Icon} />
            <span>Search workspace</span>
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
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  size="sm"
                  isActive={item.active}
                  tooltipContent={item.label}
                  aria-current={item.active ? "page" : undefined}
                  class={item.active ? "rounded-full" : "rounded-full text-muted-foreground"}
                >
                  <HugeiconsIcon icon={item.icon} />
                  <span>{item.label}</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>

      <Sidebar.Separator />

      <Sidebar.Group>
        <div class="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <Sidebar.GroupLabel class="h-7 px-2 text-[11px] font-medium uppercase tracking-wide">
            Runtime
          </Sidebar.GroupLabel>
          <Badge variant="outline">Offline</Badge>
        </div>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton size="sm" tooltipContent="PI Agent">
                <HugeiconsIcon icon={TerminalIcon} />
                <span>PI Agent</span>
                <span class="ml-auto truncate text-[11px] text-muted-foreground">Configure</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>

      <Sidebar.Separator />

      <Sidebar.Group class="min-h-0 flex-1">
        <Sidebar.GroupLabel class="h-7 px-2 text-[11px] font-medium uppercase tracking-wide">
          Recent repos
        </Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each recentRepos as repo}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  size="lg"
                  isActive={repo.status === "selected"}
                  tooltipContent={repo.name}
                  aria-pressed={repo.status === "selected"}
                  class="h-9"
                >
                  <HugeiconsIcon icon={FolderCodeIcon} />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-medium">{repo.name}</span>
                    <span class="block truncate font-mono text-[10px] text-muted-foreground">{repo.path}</span>
                  </span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>

    <Sidebar.Footer class="border-t border-sidebar-border px-2 py-2">
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="sm" tooltipContent="Settings" class="text-muted-foreground">
            <HugeiconsIcon icon={Settings05Icon} />
            <span>Settings</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
      <div class="flex items-center justify-between px-2 font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
        <span>{platform}</span>
        <span>local</span>
      </div>
    </Sidebar.Footer>

    <Sidebar.Rail />
  </Sidebar.Sidebar>

  <Sidebar.Inset class="min-w-0 overflow-hidden">
    <header class="flex h-11 items-center justify-between border-b border-border px-4">
      <div class="flex min-w-0 items-center gap-2">
        <h1 class="truncate text-sm font-semibold">H3Code</h1>
        <Badge variant="secondary">H3Code</Badge>
        <Badge variant="outline">PI offline</Badge>
      </div>
      <div class="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="sm" class="max-w-44 justify-start text-muted-foreground">
          <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
          <span class="truncate">~/Desktop/H3Code</span>
        </Button>
        <Button variant="ghost" size="sm">
          <HugeiconsIcon icon={GitBranchIcon} data-icon="inline-start" />
          main
        </Button>
        <Button variant="ghost" size="sm">gpt-5.5</Button>
        <Button size="sm">
          <HugeiconsIcon icon={AddCircleIcon} data-icon="inline-start" />
          New session
        </Button>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_24rem]">
      <section class="flex min-w-0 flex-col">
        <div class="flex h-10 items-center justify-between border-b border-border/50 px-4">
          <div class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={TerminalIcon} data-icon />
            <span class="truncate font-medium text-foreground">Transcript</span>
            <span class="truncate">No PI session connected</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline">Idle</Badge>
            <Button variant="ghost" size="sm" class="text-muted-foreground">
              <HugeiconsIcon icon={LinkSquare02Icon} data-icon="inline-start" />
              Connect
            </Button>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col">
          <div class="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
            <div class="flex w-full max-w-2xl flex-col items-center text-center">
              <div class="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
                <HugeiconsIcon icon={TerminalIcon} data-icon />
              </div>
              <p class="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Ready for first connection
              </p>
              <h2 class="mt-2 text-xl font-semibold tracking-tight">Open a repo, connect PI, then send a prompt.</h2>
              <p class="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                H3Code will render PI-owned messages, streaming assistant output, and tool activity here.
                The desktop shell does not store transcript history.
              </p>
              <div class="mt-5 flex flex-wrap justify-center gap-2">
                <Button>
                  <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
                  Open repo
                </Button>
                <Button variant="outline">
                  <HugeiconsIcon icon={TerminalIcon} data-icon="inline-start" />
                  Connect PI
                </Button>
              </div>
            </div>
          </div>

          <div class="border-t border-border/50 px-4 py-3">
            <div class="flex min-h-24 flex-col rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/30">
              <label for="prompt" class="sr-only">Prompt</label>
              <textarea
                id="prompt"
                class="min-h-16 resize-none bg-transparent px-3 py-2 text-xs leading-5 outline-none placeholder:text-muted-foreground"
                placeholder="Ask PI to inspect this repo, implement a change, or explain the current state..."
              ></textarea>
              <div class="flex h-9 items-center justify-between border-t border-border/50 px-2">
                <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline">Prompt</Badge>
                  <span>Idle commands send as prompt. Running sessions can steer or follow up.</span>
                </div>
                <div class="flex items-center gap-1">
                  <Button variant="ghost" size="sm" class="text-muted-foreground">
                    <HugeiconsIcon icon={StopCircleIcon} data-icon="inline-start" />
                    Abort
                  </Button>
                  <Button size="sm">
                    <HugeiconsIcon icon={ArrowUp02Icon} data-icon="inline-start" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="flex min-w-0 flex-col border-l border-border bg-background">
        <header class="flex h-10 items-center justify-between border-b border-border/50 px-4">
          <h2 class="text-xs font-semibold">Context</h2>
          <Badge variant="secondary">Static</Badge>
        </header>

        <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-4">
          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current repo</h3>
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="min-w-0">
                <span class="block truncate font-medium">H3Code</span>
                <span class="block truncate font-mono text-[10px] text-muted-foreground">~/Desktop/H3Code</span>
              </span>
              <Badge variant="outline">Selected</Badge>
            </div>
          </section>

          <Separator />

          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session</h3>
            <div class="grid gap-2 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">State</span>
                <span class="font-medium">Idle</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">Messages</span>
                <span class="font-medium">0</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">Queue</span>
                <span class="font-medium">Empty</span>
              </div>
            </div>
          </section>

          <Separator />

          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Runtime diagnostics</h3>
            <div class="grid gap-2 text-xs">
              {#each runtimeRows as row}
                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted-foreground">{row.label}</span>
                  <span class="truncate text-right font-medium">{row.value}</span>
                </div>
              {/each}
            </div>
          </section>

          <Separator />

          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tool activity</h3>
            <div class="flex flex-col gap-1">
              {#each toolEvents as event}
                <div class="flex h-8 items-center justify-between gap-2 rounded-md px-2 text-xs hover:bg-accent">
                  <span class="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon icon={AlertCircleIcon} data-icon />
                    <span class="truncate font-mono text-[11px]">{event.name}</span>
                  </span>
                  <span class="text-[11px] text-muted-foreground">{event.state}</span>
                </div>
              {/each}
            </div>
          </section>
        </div>
      </aside>
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
