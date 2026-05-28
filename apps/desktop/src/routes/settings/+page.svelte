<script lang="ts">
  import { onMount } from "svelte";
  import { mode, setMode } from "mode-watcher";

  import ConfirmDeleteDialog from "$lib/components/desktop/ConfirmDeleteDialog.svelte";
  import SettingsListRow from "$lib/components/desktop/SettingsListRow.svelte";
  import SettingsRow from "$lib/components/desktop/SettingsRow.svelte";
  import SettingsSection from "$lib/components/desktop/SettingsSection.svelte";
  import SettingsShell from "$lib/components/desktop/SettingsShell.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";

  const piDocsUrl = "https://pi.dev/docs";

  const segmentedButtonClass = "h-8 text-[11px] capitalize";

  let appVersion = $state("…");
  let repoRemovalOpen = $state(false);
  let repoRemovalTarget = $state<{ name: string; path: string } | undefined>();
  let clearIndexOpen = $state(false);
  let clearIndexBusy = $state(false);
  let repoRemovalBusy = $state(false);

  const sessionConnected = $derived(desktopState.piStatus.state === "connected");
  const queueControlsDisabled = $derived(
    !desktopState.canChangeSessionSettings || !desktopState.supportsQueueSettings,
  );
  const compactionControlsDisabled = $derived(
    !desktopState.canChangeSessionSettings || !desktopState.supportsCompactionSettings,
  );
  const activeModelLabel = $derived(
    desktopState.sessionState?.model
      ? `${desktopState.sessionState.model.provider}/${desktopState.sessionState.model.id}`
      : "—",
  );

  onMount(() => {
    void window.h3code?.getAppVersion().then((version) => {
      appVersion = version;
    });
  });

  function requestRemoveRepo(repo: { name: string; path: string }) {
    repoRemovalTarget = repo;
    repoRemovalOpen = true;
  }

  async function confirmRemoveRepo() {
    if (!repoRemovalTarget) {
      return;
    }

    repoRemovalBusy = true;

    try {
      await desktopState.removeRepoFromIndex(repoRemovalTarget.path);
    } finally {
      repoRemovalBusy = false;
    }
  }

  async function confirmClearIndex() {
    clearIndexBusy = true;

    try {
      await desktopState.clearAllIndexedData();
    } finally {
      clearIndexBusy = false;
    }
  }
</script>

<svelte:head><title>Settings · H3Code Desktop</title></svelte:head>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
  <SettingsShell>
    <div class="mx-auto max-w-2xl space-y-0">
      <SettingsSection id="appearance" title="Appearance" description="Theme and visual defaults.">
        <SettingsRow label="Color theme" description="Light, dark, or match your system.">
          {#snippet control()}
            <div class="flex flex-wrap gap-1" role="group" aria-label="Color theme">
              {#each ["light", "dark", "system"] as themeOption}
                <Button
                  variant={mode.current === themeOption ? "default" : "outline"}
                  size="sm"
                  class={segmentedButtonClass}
                  onclick={() => setMode(themeOption as "light" | "dark" | "system")}
                >
                  {themeOption}
                </Button>
              {/each}
            </div>
          {/snippet}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        id="workspace"
        title="Workspace"
        description="Default layout when you open the workspace. You can still toggle panels from the shell."
      >
        <SettingsRow
          label="Open sidebar on launch"
          description="Show the navigation sidebar when the app opens."
          controlId="sidebar-open"
        >
          {#snippet control()}
            <Switch
              id="sidebar-open"
              checked={desktopState.desktopSettings.sidebarOpen}
              onCheckedChange={(checked) => desktopState.setSidebarOpen(checked)}
            />
          {/snippet}
        </SettingsRow>
        <SettingsRow
          label="Show context inspector"
          description="Open the context inspector on the right when you enter the workspace."
          controlId="context-panel-open"
        >
          {#snippet control()}
            <Switch
              id="context-panel-open"
              checked={desktopState.desktopSettings.contextPanelOpen}
              onCheckedChange={(checked) => desktopState.setContextPanelOpen(checked)}
            />
          {/snippet}
        </SettingsRow>
        <SettingsRow
          label="Prefer diff inspector"
          description="When a session has uncommitted changes, open the diff panel automatically."
          controlId="prefer-diff-panel"
        >
          {#snippet control()}
            <Switch
              id="prefer-diff-panel"
              checked={desktopState.desktopSettings.preferDiffPanel}
              onCheckedChange={(checked) => desktopState.setPreferDiffPanel(checked)}
            />
          {/snippet}
        </SettingsRow>
        <SettingsRow
          label="Reconnect last repo on launch"
          description="Automatically connect to your last repository when the app opens."
          controlId="auto-connect"
        >
          {#snippet control()}
            <Switch
              id="auto-connect"
              checked={desktopState.desktopSettings.autoConnectOnLaunch}
              onCheckedChange={(checked) => desktopState.setAutoConnectOnLaunch(checked)}
            />
          {/snippet}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        id="agent"
        title="Agent"
        description="PI Agent via the local Agent Server. Model and thinking level are changed from the workspace composer."
      >
        <SettingsRow label="API keys and providers" description="Configured in PI Agent, not in H3Code.">
          {#snippet control()}
            <Button variant="outline" size="sm" class="h-8" href={piDocsUrl} target="_blank" rel="noopener noreferrer">
              PI docs
            </Button>
          {/snippet}
        </SettingsRow>

        <SettingsRow
          label="Model and thinking"
          description="Use the model and thinking controls in the workspace prompt while a session is connected."
        >
          {#snippet control()}
            <span class="text-xs text-muted-foreground">{sessionConnected ? activeModelLabel : "Not connected"}</span>
          {/snippet}
        </SettingsRow>

        <SettingsRow
          label="Steering delivery"
          description="How queued steer messages are delivered while the agent is running."
        >
          {#snippet control()}
            <div class="flex flex-wrap gap-1" role="group" aria-label="Steering delivery mode">
              {#each ["one-at-a-time", "all"] as queueMode}
                <Button
                  variant={desktopState.sessionState?.steeringMode === queueMode ? "default" : "outline"}
                  size="sm"
                  class="h-8 text-[11px]"
                  disabled={queueControlsDisabled}
                  onclick={() => desktopState.setSteeringMode(queueMode as PiQueueMode)}
                >
                  {queueMode === "one-at-a-time" ? "One" : "All"}
                </Button>
              {/each}
            </div>
          {/snippet}
        </SettingsRow>

        <SettingsRow
          label="Follow-up delivery"
          description="How follow-up messages are delivered after the agent stops."
        >
          {#snippet control()}
            <div class="flex flex-wrap gap-1" role="group" aria-label="Follow-up delivery mode">
              {#each ["one-at-a-time", "all"] as queueMode}
                <Button
                  variant={desktopState.sessionState?.followUpMode === queueMode ? "default" : "outline"}
                  size="sm"
                  class="h-8 text-[11px]"
                  disabled={queueControlsDisabled}
                  onclick={() => desktopState.setFollowUpMode(queueMode as PiQueueMode)}
                >
                  {queueMode === "one-at-a-time" ? "One" : "All"}
                </Button>
              {/each}
            </div>
          {/snippet}
        </SettingsRow>

        <SettingsRow
          label="Auto-compaction"
          description="Automatically compact context when the window is nearly full."
          controlId="auto-compaction"
        >
          {#snippet control()}
            <Switch
              id="auto-compaction"
              checked={desktopState.sessionState?.autoCompactionEnabled ?? false}
              disabled={compactionControlsDisabled}
              onCheckedChange={(checked) => desktopState.setAutoCompaction(checked)}
            />
          {/snippet}
        </SettingsRow>

        {#if sessionConnected}
          <div class="space-y-2 px-2 py-1 text-xs" role="status" aria-live="polite">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-muted-foreground">Agent</span>
              <span class="font-medium capitalize">{desktopState.piStatus.state}</span>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-muted-foreground">Repository</span>
              <span class="truncate font-medium">{desktopState.repoName}</span>
            </div>
            {#if desktopState.sessionState?.thinkingLevel}
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-muted-foreground">Thinking</span>
                <span class="font-medium capitalize">{desktopState.sessionState.thinkingLevel}</span>
              </div>
            {/if}
          </div>
        {:else if desktopState.piStatus.diagnostic}
          <p class="px-2 text-[11px] text-destructive">{desktopState.piStatus.diagnostic}</p>
        {/if}
      </SettingsSection>

      <SettingsSection
        id="data"
        title="Data"
        description="Local recents and session index stored in H3Code. This does not delete PI session files on disk."
      >
        {#if desktopState.repos.length > 0}
          <ul class="space-y-0">
            {#each desktopState.repos as repo (repo.path)}
              <SettingsListRow title={repo.name} subtitle={repo.path}>
                {#snippet actions()}
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 shrink-0 text-[11px] text-muted-foreground hover:text-destructive"
                    onclick={() => requestRemoveRepo({ name: repo.name, path: repo.path })}
                  >
                    Remove
                  </Button>
                {/snippet}
              </SettingsListRow>
            {/each}
          </ul>
        {:else}
          <p class="px-2 text-xs text-muted-foreground">No indexed repositories yet.</p>
        {/if}

        <div class="flex flex-wrap gap-2 px-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8"
            disabled={desktopState.repos.length === 0}
            onclick={() => void desktopState.revealPreferencesDatabase()}
          >
            Open preferences folder
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="h-8"
            disabled={desktopState.repos.length === 0}
            onclick={() => {
              clearIndexOpen = true;
            }}
          >
            Clear local index
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection id="about" title="About" description="Application and runtime diagnostics.">
        <dl class="grid gap-3 px-2 text-xs">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <dt class="text-muted-foreground">Version</dt>
            <dd class="font-medium">{appVersion}</dd>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <dt class="text-muted-foreground">Platform</dt>
            <dd class="font-medium">{desktopState.platform}</dd>
          </div>
          <div class="flex flex-wrap items-start justify-between gap-4">
            <dt class="shrink-0 text-muted-foreground">Preferences DB</dt>
            <dd class="max-w-md truncate text-right font-mono text-[11px] font-medium">
              {desktopState.preferencesDatabasePath ?? "Loading…"}
            </dd>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <dt class="text-muted-foreground">Indexed repos</dt>
            <dd class="font-medium">{desktopState.repos.length}</dd>
          </div>
          {#if desktopState.piStatus.diagnostic && !sessionConnected}
            <div class="flex flex-wrap items-start justify-between gap-4">
              <dt class="shrink-0 text-muted-foreground">Diagnostic</dt>
              <dd class="max-w-md text-right text-muted-foreground">{desktopState.piStatus.diagnostic}</dd>
            </div>
          {/if}
        </dl>
      </SettingsSection>
    </div>
  </SettingsShell>
</div>

<ConfirmDeleteDialog
  bind:open={repoRemovalOpen}
  title="Remove repository from index?"
  description={repoRemovalTarget
    ? `Remove ${repoRemovalTarget.name} from H3Code recents and the local session index. PI session files on disk are not deleted.`
    : ""}
  confirmLabel="Remove"
  busy={repoRemovalBusy}
  onConfirm={confirmRemoveRepo}
/>

<ConfirmDeleteDialog
  bind:open={clearIndexOpen}
  title="Clear local index?"
  description="Remove all repositories from H3Code recents and delete the local session index. PI session files on disk are not deleted."
  confirmLabel="Clear index"
  busy={clearIndexBusy}
  onConfirm={confirmClearIndex}
/>
