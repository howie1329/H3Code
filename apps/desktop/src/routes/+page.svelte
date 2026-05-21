<script lang="ts">
  const platform = typeof window === "undefined" ? "desktop" : (window.h3code?.platform ?? "desktop");
</script>

<svelte:head>
  <title>H3Code Desktop</title>
  <meta name="description" content="H3Code desktop scaffold." />
</svelte:head>

<main class="flex min-h-screen bg-background text-foreground">
  <aside class="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4">
    <div class="flex h-8 items-center px-2 text-xs font-semibold tracking-tight">H3Code</div>
    <nav class="mt-5 space-y-1" aria-label="Primary">
      <a
        href="/"
        class="flex h-7 items-center rounded-full bg-sidebar-accent px-2.5 text-xs font-medium text-foreground"
      >
        Desktop
      </a>
    </nav>
    <div class="mt-auto px-2 font-mono text-[11px] text-muted-foreground">{platform}</div>
  </aside>

  <section class="flex min-w-0 flex-1 flex-col">
    <header class="flex h-11 items-center border-b border-border px-4">
      <h1 class="text-sm font-semibold">H3Code Desktop</h1>
    </header>

    <div class="flex flex-1 items-center justify-center px-6">
      <div class="max-w-md text-center">
        <p class="text-xs font-medium uppercase text-muted-foreground">Scaffold ready</p>
        <h2 class="mt-3 text-xl font-semibold tracking-tight">Electron and SvelteKit are wired up.</h2>
        <p class="mt-3 text-sm leading-6 text-muted-foreground">
          This is the minimal desktop shell for the MVP. Provider and harness workflows can be layered in
          from here.
        </p>
      </div>
    </div>
  </section>
</main>
