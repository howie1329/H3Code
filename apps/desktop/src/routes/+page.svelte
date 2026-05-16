<svelte:head>
  <title>H3 Code</title>
</svelte:head>

<main class="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
  <aside class="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] p-3">
    <div class="mb-6 text-sm font-semibold">H3 Code</div>

    <section class="space-y-2">
      <h2 class="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Repos</h2>
      <p class="rounded-md px-2 py-1.5 text-xs text-[var(--muted-foreground)]">No repos added</p>
    </section>

    <section class="mt-6 space-y-2">
      <h2 class="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Sessions</h2>
      <p class="rounded-md px-2 py-1.5 text-xs text-[var(--muted-foreground)]">No active session</p>
    </section>

    <div class="mt-auto text-[11px] text-[var(--muted-foreground)]">Pi Desk scaffold</div>
  </aside>

  <section class="flex min-w-0 flex-1 flex-col">
    <header class="flex h-12 items-center border-b border-[var(--border)] px-4">
      <h1 class="text-sm font-semibold">Desktop app scaffold</h1>
    </header>

    <div class="flex flex-1 items-center justify-center p-6">
      <div class="max-w-md text-center">
        <p class="text-base font-semibold">Ready for Pi session work</p>
        <p class="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
          SvelteKit, Tailwind, and Electron are wired for local development.
        </p>
      </div>
    </div>
  </section>
</main>
