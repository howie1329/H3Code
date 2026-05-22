<script lang="ts">
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
</script>

<svelte:head><title>Settings · H3Code Desktop</title></svelte:head>

<div class="min-h-0 flex-1 overflow-auto p-6">
  <div class="max-w-3xl">
    <header class="space-y-2">
      <h2 class="text-xl font-semibold tracking-tight">Settings</h2>
      <p class="max-w-2xl text-xs leading-5 text-muted-foreground">
        Desktop preferences and app-level runtime status.
      </p>
    </header>

    <section class="mt-6 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold leading-tight">Runtime</h3>
          <p class="mt-1 text-xs text-muted-foreground">PI connection and local process details.</p>
        </div>
        <Badge variant={desktopState.piStatus.state === "connected" ? "secondary" : "outline"}>PI {desktopState.piStatus.state}</Badge>
      </div>

      <Separator />

      <dl class="grid gap-3 text-xs">
        <div class="flex items-center justify-between gap-4">
          <dt class="text-muted-foreground">PI RPC</dt>
          <dd class="truncate text-right font-medium">{desktopState.piStatus.state}</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="text-muted-foreground">Executable</dt>
          <dd class="truncate text-right font-medium">pi</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="text-muted-foreground">Working dir</dt>
          <dd class="truncate text-right font-medium">{desktopState.repoPath ?? "None"}</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="text-muted-foreground">Platform</dt>
          <dd class="truncate text-right font-medium">{desktopState.platform}</dd>
        </div>
        {#if desktopState.piStatus.diagnostic || desktopState.errorMessage}
          <div class="flex items-start justify-between gap-4">
            <dt class="text-muted-foreground">Diagnostic</dt>
            <dd class="max-w-xl text-right text-muted-foreground">{desktopState.piStatus.diagnostic ?? desktopState.errorMessage}</dd>
          </div>
        {/if}
      </dl>
    </section>
  </div>
</div>
