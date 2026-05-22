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

<main class="flex h-screen overflow-hidden bg-background text-foreground">
  <aside class="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
    <header class="flex h-11 items-center justify-between px-3">
      <a href="/" class="flex min-w-0 items-center gap-2" aria-label="H3Code workspace">
        <span class="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
          H3
        </span>
        <span class="truncate text-xs font-semibold tracking-tight">H3Code</span>
      </a>
      <Button variant="ghost" size="icon-sm" aria-label="New session">
        <HugeiconsIcon icon={AddCircleIcon} data-icon />
      </Button>
    </header>

    <div class="px-3 pb-3">
      <Button variant="outline" size="sm" class="w-full justify-start text-muted-foreground">
        <HugeiconsIcon icon={SearchList01Icon} data-icon="inline-start" />
        Search workspace
      </Button>
    </div>

    <Separator />

    <nav class="flex flex-col gap-1 px-2 py-3" aria-label="Primary">
      {#each navItems as item}
        <Button
          href="/"
          variant={item.active ? "secondary" : "ghost"}
          size="sm"
          class="w-full justify-start"
          aria-current={item.active ? "page" : undefined}
        >
          <HugeiconsIcon icon={item.icon} data-icon="inline-start" />
          {item.label}
        </Button>
      {/each}
    </nav>

    <Separator />

    <section class="flex flex-col gap-2 px-3 py-3" aria-labelledby="runtime-heading">
      <div class="flex items-center justify-between gap-2 px-1">
        <h2 id="runtime-heading" class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Runtime
        </h2>
        <Badge variant="outline">Offline</Badge>
      </div>
      <button
        type="button"
        class="flex h-8 items-center justify-between gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span class="flex min-w-0 items-center gap-2">
          <HugeiconsIcon icon={TerminalIcon} data-icon />
          <span class="truncate">PI Agent</span>
        </span>
        <span class="truncate text-[11px] text-muted-foreground">Configure</span>
      </button>
    </section>

    <Separator />

    <section class="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3" aria-labelledby="repos-heading">
      <h2 id="repos-heading" class="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Recent repos
      </h2>
      <div class="flex flex-col gap-1">
        {#each recentRepos as repo}
          <button
            type="button"
            class="flex min-h-9 items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-pressed={repo.status === "selected"}
          >
            <HugeiconsIcon icon={FolderCodeIcon} data-icon />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{repo.name}</span>
              <span class="block truncate font-mono text-[10px] text-muted-foreground">{repo.path}</span>
            </span>
          </button>
        {/each}
      </div>
    </section>

    <footer class="border-t border-sidebar-border px-3 py-3">
      <Button variant="ghost" size="sm" class="w-full justify-start text-muted-foreground">
        <HugeiconsIcon icon={Settings05Icon} data-icon="inline-start" />
        Settings
      </Button>
      <div class="mt-2 flex items-center justify-between px-2 font-mono text-[10px] text-muted-foreground">
        <span>{platform}</span>
        <span>local</span>
      </div>
    </footer>
  </aside>

  <section class="flex min-w-0 flex-1 flex-col">
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
  </section>
</main>
