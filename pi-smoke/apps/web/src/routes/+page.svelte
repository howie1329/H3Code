<script lang="ts">
  import { ArrowUpRight01Icon, Moon02Icon, Sun02Icon } from '@hugeicons/core-free-icons';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { toggleMode } from 'mode-watcher';

  import ProductPreview from '$lib/components/marketing/ProductPreview.svelte';
  import { Button } from '$lib/components/ui/button/index.js';

  const githubUrl = 'https://github.com/howie1329/H3Code';
  const docsUrl =
    'https://github.com/howie1329/H3Code/blob/main/docs/h3code-agent-server-product.md';
  const architectureUrl =
    'https://github.com/howie1329/H3Code/blob/main/docs/agent-server-architecture.html.html';

  const capabilities = [
    {
      title: 'Local repo context',
      description:
        'Point agents at folders on your machine. Sessions stay tied to the repository they modify.'
    },
    {
      title: 'Provider-neutral protocol',
      description:
        'The desktop speaks H3Code over WebSocket. PI is the working provider; Codex and Cursor follow the same surface.'
    },
    {
      title: 'Session continuity',
      description:
        'Resume runs, inspect tool output, and read git diffs without leaving the workbench.'
    },
    {
      title: 'Connection you can see',
      description:
        'Server health, run state, and errors stay visible so you know when the agent is actually working.'
    }
  ];

  const workflow = [
    {
      title: 'Open a repository',
      description: 'Choose the local project the agent should use as workspace context.'
    },
    {
      title: 'Run the agent',
      description: 'Send prompts, steer mid-run, and watch tools execute against real files.'
    },
    {
      title: 'Review and return',
      description: 'Read the transcript, diff the session, and pick up where you left off.'
    }
  ];
</script>

<svelte:head>
  <title>H3 Code — Local workbench for AI coding agents</title>
  <meta
    name="description"
    content="H3 Code is a macOS desktop workbench for running AI coding agents on local repositories with a provider-neutral Agent Server."
  />
</svelte:head>

<main class="min-h-screen bg-background text-foreground">
  <div class="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8 lg:px-10">
    <header class="flex items-center justify-between gap-4 py-5">
      <a
        href="/"
        class="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground"
        aria-label="H3 Code home"
      >
        <img src="/icons/h3code-light.svg" alt="" class="size-7 shrink-0 rounded-md dark:hidden" />
        <img src="/icons/h3code-dark.svg" alt="" class="hidden size-7 shrink-0 rounded-md dark:block" />
        <span>H3 Code</span>
      </a>

      <nav class="flex items-center gap-1 sm:gap-2" aria-label="Site">
        <Button variant="ghost" size="sm" href={docsUrl} target="_blank" rel="noopener noreferrer">
          Product overview
        </Button>
        <Button variant="ghost" size="sm" class="hidden sm:inline-flex" href={architectureUrl} target="_blank" rel="noopener noreferrer">
          Architecture
        </Button>
        <Button variant="ghost" size="icon-sm" onclick={toggleMode} aria-label="Toggle color theme">
          <span class="relative grid size-4 place-items-center">
            <HugeiconsIcon
              icon={Sun02Icon}
              size={16}
              className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
            />
            <HugeiconsIcon
              icon={Moon02Icon}
              size={16}
              className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
            />
          </span>
        </Button>
      </nav>
    </header>

    <section class="pb-16 pt-6 sm:pb-20 sm:pt-10">
      <div class="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
        <div class="max-w-xl">
          <h1 class="text-display-hero text-foreground">
            A local workbench for coding agents on your repositories.
          </h1>
          <p class="text-lead mt-5 max-w-lg text-muted-foreground">
            H3 Code is a macOS desktop shell around a local Agent Server. Manage provider sessions,
            repo context, transcripts, and git state in one dense surface built for long dev sessions.
          </p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button size="lg" href={githubUrl} target="_blank" rel="noopener noreferrer">
              View source on GitHub
              <HugeiconsIcon icon={ArrowUpRight01Icon} data-icon className="opacity-80" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read product overview
            </Button>
          </div>
          <p class="mt-4 text-xs leading-relaxed text-muted-foreground">
            macOS first. Windows and Linux planned. Early desktop builds are in active development on
            GitHub.
          </p>
        </div>

        <div class="lg:pt-2">
          <ProductPreview />
          <p class="mt-3 text-center text-xs text-muted-foreground sm:text-left">
            Representative UI composition. Screens update as the desktop app ships.
          </p>
        </div>
      </div>
    </section>

    <section class="border-t border-border py-16 sm:py-20">
      <div class="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <h2 class="text-display-section text-foreground">Built for sessions that last hours.</h2>
          <p class="text-lead mt-4 max-w-md text-muted-foreground">
            The marketing site stays out of the way. The product is the transcript, the tools, and the
            repo panel you keep open beside your editor.
          </p>
        </div>
        <ul class="divide-y divide-border rounded-lg border border-border bg-card">
          {#each capabilities as item}
            <li class="p-5 sm:p-6">
              <h3 class="text-sm font-semibold text-foreground">{item.title}</h3>
              <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <section class="border-t border-border py-16 sm:py-20">
      <div class="rounded-xl border border-border bg-card p-8 sm:p-10">
        <h2 class="text-display-section max-w-2xl text-foreground">How a coding session flows</h2>
        <p class="text-lead mt-3 max-w-xl text-muted-foreground">
          Three moves, repeated. No signup funnel, no dashboard of vanity metrics.
        </p>
        <ol class="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {#each workflow as step}
            <li>
              <h3 class="text-base font-semibold text-foreground">{step.title}</h3>
              <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          {/each}
        </ol>
      </div>
    </section>

    <section class="border-t border-border py-16 sm:py-20">
      <div
        class="flex flex-col items-start justify-between gap-6 rounded-xl border border-border bg-muted/30 p-8 sm:flex-row sm:items-center sm:p-10"
      >
        <div class="max-w-lg">
          <h2 class="text-display-section text-foreground">Follow the build in the open.</h2>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
            Source, architecture notes, and the Agent Server product brief live in the repository.
            Watch issues and PRs for desktop releases.
          </p>
        </div>
        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button href={githubUrl} target="_blank" rel="noopener noreferrer">Open GitHub repository</Button>
          <Button variant="outline" href={docsUrl} target="_blank" rel="noopener noreferrer">
            Read product brief
          </Button>
        </div>
      </div>
    </section>

    <footer class="mt-auto border-t border-border py-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-muted-foreground">
          © {new Date().getFullYear()} H3 Code. Local agent workbench for developers.
        </p>
        <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <a
            class="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            class="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Product brief
          </a>
          <a
            class="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={architectureUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Architecture
          </a>
        </div>
      </div>
    </footer>
  </div>
</main>
