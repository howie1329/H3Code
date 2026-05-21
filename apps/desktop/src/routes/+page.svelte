<script lang="ts">
  import {
    AddCircleIcon,
    AiBrain02Icon,
    Clock04Icon,
    FolderCodeIcon,
    GitBranchIcon,
    Layout02Icon,
    SearchList01Icon,
    Settings05Icon,
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

  const providers = [
    { name: "OpenAI", status: "Ready" },
    { name: "Anthropic", status: "Not connected" },
    { name: "Local", status: "Idle" },
  ];

  const recentRepos = ["H3Code", "agentkit-labs", "desktop-shell"];
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

    <section class="flex flex-col gap-2 px-3 py-3" aria-labelledby="providers-heading">
      <h2 id="providers-heading" class="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Providers
      </h2>
      <div class="flex flex-col gap-1">
        {#each providers as provider}
          <button
            type="button"
            class="flex h-8 items-center justify-between gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span class="truncate">{provider.name}</span>
            <span class="truncate text-[11px] text-muted-foreground">{provider.status}</span>
          </button>
        {/each}
      </div>
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
            class="flex h-8 items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HugeiconsIcon icon={FolderCodeIcon} data-icon />
            <span class="truncate">{repo}</span>
          </button>
        {/each}
      </div>
    </section>

    <footer class="border-t border-sidebar-border px-3 py-3">
      <Button variant="ghost" size="sm" class="w-full justify-start text-muted-foreground">
        <HugeiconsIcon icon={Settings05Icon} data-icon="inline-start" />
        Settings
      </Button>
      <div class="mt-2 px-2 font-mono text-[11px] text-muted-foreground">{platform}</div>
    </footer>
  </aside>

  <section class="flex min-w-0 flex-1 flex-col">
    <header class="flex h-11 items-center justify-between border-b border-border px-4">
      <div class="flex min-w-0 items-center gap-2">
        <h1 class="truncate text-sm font-semibold">Workspace</h1>
        <Badge variant="secondary">UI scaffold</Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          <HugeiconsIcon icon={GitBranchIcon} data-icon="inline-start" />
          main
        </Button>
        <Button size="sm">
          <HugeiconsIcon icon={AddCircleIcon} data-icon="inline-start" />
          New session
        </Button>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem]">
      <section class="flex min-w-0 flex-col">
        <div class="flex h-10 items-center justify-between border-b border-border/50 px-4">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={TerminalIcon} data-icon />
            <span>Agent workspace</span>
          </div>
          <Badge variant="outline">No active run</Badge>
        </div>

        <div class="flex flex-1 items-center justify-center px-6">
          <div class="max-w-md text-center">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ready for UI wiring</p>
            <h2 class="mt-3 text-xl font-semibold tracking-tight">Choose a repo and start a session.</h2>
            <p class="mt-3 text-sm leading-6 text-muted-foreground">
              This workspace area is intentionally static for now. It gives us the shell for repos,
              provider-backed sessions, and agent output without adding behavior yet.
            </p>
            <div class="mt-5 flex justify-center gap-2">
              <Button>
                <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
                Open repo
              </Button>
              <Button variant="outline">
                <HugeiconsIcon icon={AiBrain02Icon} data-icon="inline-start" />
                Pick provider
              </Button>
            </div>
          </div>
        </div>
      </section>

      <aside class="flex min-w-0 flex-col border-l border-border bg-background">
        <header class="flex h-10 items-center border-b border-border/50 px-4">
          <h2 class="text-xs font-semibold">Context</h2>
        </header>

        <div class="flex flex-col gap-5 p-4">
          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current repo</h3>
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="truncate font-medium">None selected</span>
              <Badge variant="secondary">Idle</Badge>
            </div>
          </section>

          <Separator />

          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session</h3>
            <p class="text-xs leading-5 text-muted-foreground">
              No agent session is running. The next pass can connect these controls to real state.
            </p>
          </section>
        </div>
      </aside>
    </div>
  </section>
</main>
