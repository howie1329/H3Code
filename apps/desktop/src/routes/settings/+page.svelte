<script lang="ts">
  import { mode, setMode } from "mode-watcher";

  import SettingsShell from "$lib/components/desktop/SettingsShell.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
</script>

<svelte:head><title>Settings · H3Code Desktop</title></svelte:head>

<SettingsShell>
  <div class="max-w-2xl space-y-8">
    <header class="space-y-2">
      <h2 class="text-xl font-semibold tracking-tight">Settings</h2>
      <p class="text-xs leading-5 text-muted-foreground">Desktop preferences and local runtime details.</p>
    </header>

    <section id="appearance" class="scroll-mt-6 space-y-4">
      <div>
        <h3 class="text-base font-semibold leading-tight">Appearance</h3>
        <p class="mt-1 text-xs text-muted-foreground">Theme and layout defaults.</p>
      </div>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-medium">Color theme</p>
          <p class="text-[11px] text-muted-foreground">Switch between light and dark.</p>
        </div>
        <div class="flex gap-1">
          <Button
            variant={mode.current === "light" ? "default" : "outline"}
            size="sm"
            class="h-8"
            onclick={() => setMode("light")}
          >
            Light
          </Button>
          <Button
            variant={mode.current === "dark" ? "default" : "outline"}
            size="sm"
            class="h-8"
            onclick={() => setMode("dark")}
          >
            Dark
          </Button>
        </div>
      </div>
    </section>

    <Separator />

    <section id="workspace" class="scroll-mt-6 space-y-4">
      <div>
        <h3 class="text-base font-semibold leading-tight">Workspace</h3>
        <p class="mt-1 text-xs text-muted-foreground">Shell layout preferences.</p>
      </div>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-medium">Open sidebar on launch</p>
          <p class="text-[11px] text-muted-foreground">Show the navigation sidebar when the app opens.</p>
        </div>
        <Button
          variant={desktopState.desktopSettings.sidebarOpen ? "default" : "outline"}
          size="sm"
          class="h-8"
          onclick={() => desktopState.setSidebarOpen(!desktopState.desktopSettings.sidebarOpen)}
        >
          {desktopState.desktopSettings.sidebarOpen ? "On" : "Off"}
        </Button>
      </div>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-medium">Show context panel</p>
          <p class="text-[11px] text-muted-foreground">Open the session context inspector by default.</p>
        </div>
        <Button
          variant={desktopState.desktopSettings.contextPanelOpen ? "default" : "outline"}
          size="sm"
          class="h-8"
          onclick={() => desktopState.setContextPanelOpen(!desktopState.desktopSettings.contextPanelOpen)}
        >
          {desktopState.desktopSettings.contextPanelOpen ? "On" : "Off"}
        </Button>
      </div>
    </section>

    <Separator />

    <section id="runtime" class="scroll-mt-6 space-y-4">
      <div>
        <h3 class="text-base font-semibold leading-tight">Runtime</h3>
        <p class="mt-1 text-xs text-muted-foreground">PI connection and local process details (read-only).</p>
      </div>
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
        <div class="flex items-center justify-between gap-4">
          <dt class="text-muted-foreground">Preferences DB</dt>
          <dd class="truncate text-right font-mono text-[11px] font-medium">{desktopState.preferencesDatabasePath ?? "Loading"}</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="text-muted-foreground">Recent repos</dt>
          <dd class="truncate text-right font-medium">{desktopState.repos.length}</dd>
        </div>
        {#if desktopState.piStatus.diagnostic}
          <div class="flex items-start justify-between gap-4">
            <dt class="text-muted-foreground">Diagnostic</dt>
            <dd class="max-w-xl text-right text-muted-foreground">{desktopState.piStatus.diagnostic}</dd>
          </div>
        {/if}
      </dl>
    </section>
  </div>
</SettingsShell>
