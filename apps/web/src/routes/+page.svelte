<script lang="ts">
  import { Moon02Icon, Sun02Icon } from '@hugeicons/core-free-icons';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { toggleMode } from 'mode-watcher';

  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';

  const proofPoints = ['Local repos', 'Multiple providers', 'Resumable sessions', 'Desktop shell'];

  const features = [
    {
      title: 'Local repo context',
      description:
        'Start from the repositories on your machine and keep agent work tied to the codebase it belongs to.'
    },
    {
      title: 'Multiple providers and harnesses',
      description:
        'Use one desktop surface for different AI providers and coding-agent workflows instead of scattering sessions across tools.'
    },
    {
      title: 'Session continuity',
      description:
        'Return to prior agent runs, understand what changed, and keep long-running coding tasks organized.'
    }
  ];

  const workflow = [
    {
      step: '01',
      title: 'Pick a repository',
      description: 'Choose the local project where the agent should work.'
    },
    {
      step: '02',
      title: 'Start an agent session',
      description: 'Launch the provider or harness that fits the task.'
    },
    {
      step: '03',
      title: 'Resume or review work',
      description: 'Come back to active sessions and keep changes easy to inspect.'
    }
  ];
</script>

<svelte:head>
  <title>H3 Code — AI coding agents for local repositories</title>
  <meta
    name="description"
    content="H3 Code is a desktop UI for running AI coding agents across local repositories."
  />
</svelte:head>

<main class="min-h-screen bg-background text-foreground">
  <div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-5 sm:px-8 lg:px-10">
    <header class="flex items-center justify-between gap-4">
      <a href="/" class="text-xs font-semibold tracking-tight text-foreground" aria-label="H3 Code home">
        H3 Code
      </a>
      <Button variant="ghost" size="icon" onclick={toggleMode} aria-label="Toggle theme">
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
    </header>

    <section class="flex flex-1 flex-col justify-center py-20 sm:py-28">
      <div class="max-w-3xl">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">MacOS first desktop UI</p>
        <h1 class="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Run AI coding agents across local repositories.
        </h1>
        <p class="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
          H3 Code gives developers a quiet desktop command center for managing provider-backed agent
          sessions, local repo context, and resumable coding work.
        </p>
        <div class="mt-7 flex flex-col items-start gap-3">
          <Button disabled size="lg">Early access soon</Button>
          <p class="text-xs text-muted-foreground">macOS first. Windows and Linux planned.</p>
        </div>
      </div>

      <div class="mt-10 flex flex-wrap gap-2" aria-label="Product capabilities">
        {#each proofPoints as point}
          <Badge variant="secondary">{point}</Badge>
        {/each}
      </div>
    </section>

    <Separator />

    <section class="grid gap-8 py-14 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why it exists</p>
        <h2 class="mt-3 text-xl font-semibold tracking-tight">Keep agent work in one place.</h2>
      </div>
      <div class="grid gap-8 sm:grid-cols-3">
        {#each features as feature}
          <article>
            <h3 class="text-sm font-semibold text-foreground">{feature.title}</h3>
            <p class="mt-2 text-xs leading-5 text-muted-foreground">{feature.description}</p>
          </article>
        {/each}
      </div>
    </section>

    <Separator />

    <section class="grid gap-8 py-14 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflow</p>
        <h2 class="mt-3 text-xl font-semibold tracking-tight">A simple loop for coding agents.</h2>
      </div>
      <ol class="grid gap-5">
        {#each workflow as item}
          <li class="grid gap-3 border-l border-border pl-4 sm:grid-cols-[3rem_1fr] sm:border-l-0 sm:pl-0">
            <span class="font-mono text-[11px] text-muted-foreground">{item.step}</span>
            <div>
              <h3 class="text-sm font-semibold text-foreground">{item.title}</h3>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
            </div>
          </li>
        {/each}
      </ol>
    </section>

    <Separator />

    <section class="grid gap-8 py-14 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
        <h2 class="mt-3 text-xl font-semibold tracking-tight">Early access is not open yet.</h2>
      </div>
      <div class="grid gap-3 text-xs leading-5 text-muted-foreground sm:grid-cols-3">
        <p><span class="font-medium text-foreground">macOS first.</span> The desktop experience starts on macOS.</p>
        <p><span class="font-medium text-foreground">Windows and Linux planned.</span> Cross-platform support follows.</p>
        <p><span class="font-medium text-foreground">No signup yet.</span> Access will open when the first build is ready.</p>
      </div>
    </section>

    <Separator />

    <section class="flex flex-col items-start justify-between gap-5 py-10 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-base font-semibold tracking-tight">H3 Code is coming soon.</h2>
        <p class="mt-1 text-xs text-muted-foreground">A local desktop UI for developers working with AI coding agents.</p>
      </div>
      <Button disabled>Early access soon</Button>
    </section>
  </div>
</main>
