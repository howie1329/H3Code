<script lang="ts">
  import { onMount } from "svelte";
  import { mode, setMode } from "mode-watcher";

  import ConfirmDeleteDialog from "$lib/components/desktop/ConfirmDeleteDialog.svelte";
  import SettingsRow from "$lib/components/desktop/SettingsRow.svelte";
  import SettingsSection from "$lib/components/desktop/SettingsSection.svelte";
  import SettingsShell from "$lib/components/desktop/SettingsShell.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";

  const piRpcDocsUrl = "https://pi.dev/docs/latest/rpc#starting-rpc-mode";
  const piDocsUrl = "https://pi.dev/docs";

  let piExecutableDraft = $state(desktopState.piExecutablePath);
  let piExecutableSaving = $state(false);
  let piExecutableError = $state<string | undefined>();
  let appVersion = $state("…");
  let repoRemovalOpen = $state(false);
  let repoRemovalTarget = $state<{ name: string; path: string } | undefined>();
  let clearIndexOpen = $state(false);
  let clearIndexBusy = $state(false);
  let repoRemovalBusy = $state(false);
  let worktreeRemovalOpen = $state(false);
  let worktreeRemovalTarget = $state<PiWorktreeSummary | undefined>();
  let worktreeRemovalBusy = $state(false);
  let pruneWorktreesOpen = $state(false);
  let pruneWorktreesBusy = $state(false);
  let worktreeArchiveOpen = $state(false);
  let worktreeArchiveTarget = $state<PiWorktreeSummary | undefined>();
  let worktreeArchiveBusy = $state(false);

  const piExecutableDirty = $derived(piExecutableDraft.trim() !== desktopState.piExecutablePath);
  const sessionConnected = $derived(desktopState.piStatus.state === "connected");
  const agentControlsDisabled = $derived(!desktopState.canChangeSessionSettings);
  const activeModelLabel = $derived(
    desktopState.sessionState?.model
      ? `${desktopState.sessionState.model.provider}/${desktopState.sessionState.model.id}`
      : "—",
  );
  const stalePruneableCount = $derived(desktopState.worktrees.filter((worktree) => worktree.pruneable).length);
  const worktreeGroups = $derived.by(() => {
    const groups = new Map<string, { repoName: string; repoPath: string; worktrees: PiWorktreeSummary[] }>();

    for (const worktree of desktopState.worktrees) {
      const group = groups.get(worktree.repoPath) ?? {
        repoName: worktree.repoName,
        repoPath: worktree.repoPath,
        worktrees: [],
      };
      group.worktrees.push(worktree);
      groups.set(worktree.repoPath, group);
    }

    return [...groups.values()];
  });

  $effect(() => {
    piExecutableDraft = desktopState.piExecutablePath;
  });

  onMount(() => {
    void window.h3code?.getAppVersion().then((version) => {
      appVersion = version;
    });
    void desktopState.refreshWorktrees();
  });

  async function savePiExecutablePath() {
    piExecutableSaving = true;
    piExecutableError = undefined;

    try {
      await desktopState.setPiExecutablePath(piExecutableDraft);
      piExecutableDraft = desktopState.piExecutablePath;
    } catch (error) {
      piExecutableError = error instanceof Error ? error.message : String(error);
    } finally {
      piExecutableSaving = false;
    }
  }

  async function browsePiExecutable() {
    const path = await desktopState.pickPiExecutable();

    if (path) {
      piExecutableDraft = path;
    }
  }

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

  function requestRemoveWorktree(worktree: PiWorktreeSummary) {
    worktreeRemovalTarget = worktree;
    worktreeRemovalOpen = true;
  }

  function requestArchiveWorktree(worktree: PiWorktreeSummary) {
    worktreeArchiveTarget = worktree;
    worktreeArchiveOpen = true;
  }

  async function confirmRemoveWorktree() {
    if (!worktreeRemovalTarget) {
      return;
    }

    worktreeRemovalBusy = true;

    try {
      await desktopState.removeStaleWorktree(worktreeRemovalTarget.sessionPath);
    } finally {
      worktreeRemovalBusy = false;
    }
  }

  async function confirmArchiveWorktree() {
    if (!worktreeArchiveTarget) {
      return;
    }

    worktreeArchiveBusy = true;

    try {
      await desktopState.archiveSessionWorktree(worktreeArchiveTarget.sessionPath);
    } finally {
      worktreeArchiveBusy = false;
    }
  }

  async function confirmPruneWorktrees() {
    pruneWorktreesBusy = true;

    try {
      await desktopState.pruneStaleWorktrees();
    } finally {
      pruneWorktreesBusy = false;
    }
  }

  function getWorktreeTitle(worktree: PiWorktreeSummary) {
    return worktree.sessionName || worktree.sessionId || "Unmapped session";
  }

  function getWorktreeStatusLabel(worktree: PiWorktreeSummary) {
    if (worktree.status === "running") {
      return "Running";
    }

    if (worktree.status === "idle") {
      return "Idle";
    }

    if (worktree.status === "stopped") {
      return "Stopped";
    }

    return worktree.exists ? "Stale" : "Missing";
  }

  function getWorktreeDirtyLabel(worktree: PiWorktreeSummary) {
    if (!worktree.exists) {
      return "Path missing";
    }

    if (!worktree.appOwned) {
      return "External";
    }

    if (worktree.dirtyState === "dirty") {
      return "Dirty - kept";
    }

    if (worktree.dirtyState === "unknown") {
      return "Unknown - kept";
    }

    if (worktree.sessionFileInWorktree) {
      return "Clean - session local";
    }

    return "Clean";
  }
</script>

<svelte:head><title>Settings · H3Code Desktop</title></svelte:head>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
<SettingsShell>
  <div class="mx-auto max-w-3xl space-y-8">
    <header class="space-y-2">
      <h2 class="text-xl font-semibold tracking-tight">Settings</h2>
      <p class="text-xs leading-5 text-muted-foreground">
        Desktop preferences, PI Agent connection, and local index data.
      </p>
    </header>

    <SettingsSection id="appearance" title="Appearance" description="Theme and visual defaults.">
      <SettingsRow label="Color theme" description="Light, dark, or match your system.">
        {#snippet control()}
          <div class="flex gap-1" role="group" aria-label="Color theme">
            {#each ["light", "dark", "system"] as themeOption}
              <Button
                variant={mode.current === themeOption ? "default" : "outline"}
                size="sm"
                class="h-8 capitalize"
                onclick={() => setMode(themeOption as "light" | "dark" | "system")}
              >
                {themeOption}
              </Button>
            {/each}
          </div>
        {/snippet}
      </SettingsRow>
    </SettingsSection>

    <Separator />

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
        description="Automatically start PI RPC for your last repository when the app opens."
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

    <Separator />

    <SettingsSection
      id="agent"
      title="Agent"
      description="PI Agent RPC runtime. Model and thinking level are changed from the workspace composer."
    >
      <div class="space-y-2 rounded-lg border border-border/50 p-3">
        <Label for="pi-executable" class="text-xs font-medium">PI executable</Label>
        <p class="text-[11px] text-muted-foreground">
          Command used for
          <code class="font-mono text-[10px]">pi --mode rpc</code>.
          <a
            href={piRpcDocsUrl}
            class="text-foreground underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >Learn more</a>
        </p>
        <div class="flex gap-2">
          <Input
            id="pi-executable"
            bind:value={piExecutableDraft}
            class="h-8 flex-1 font-mono text-xs"
            disabled={piExecutableSaving}
          />
          <Button variant="outline" size="sm" class="h-8 shrink-0" disabled={piExecutableSaving} onclick={browsePiExecutable}>
            Browse
          </Button>
          <Button
            size="sm"
            class="h-8 shrink-0"
            disabled={piExecutableSaving || !piExecutableDirty || piExecutableDraft.trim().length === 0}
            onclick={savePiExecutablePath}
          >
            Save
          </Button>
        </div>
        {#if piExecutableError}
          <p class="text-[11px] text-destructive">{piExecutableError}</p>
        {/if}
      </div>

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
          <div class="flex gap-1" role="group" aria-label="Steering delivery mode">
            {#each ["one-at-a-time", "all"] as queueMode}
              <Button
                variant={desktopState.sessionState?.steeringMode === queueMode ? "default" : "outline"}
                size="sm"
                class="h-8 text-[11px]"
                disabled={agentControlsDisabled}
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
          <div class="flex gap-1" role="group" aria-label="Follow-up delivery mode">
            {#each ["one-at-a-time", "all"] as queueMode}
              <Button
                variant={desktopState.sessionState?.followUpMode === queueMode ? "default" : "outline"}
                size="sm"
                class="h-8 text-[11px]"
                disabled={agentControlsDisabled}
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
            disabled={agentControlsDisabled}
            onCheckedChange={(checked) => desktopState.setAutoCompaction(checked)}
          />
        {/snippet}
      </SettingsRow>

      {#if sessionConnected}
        <div
          class="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs"
          role="status"
          aria-live="polite"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-muted-foreground">PI RPC</span>
            <span class="font-medium capitalize">{desktopState.piStatus.state}</span>
          </div>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span class="text-muted-foreground">Repository</span>
            <span class="truncate font-medium">{desktopState.repoName}</span>
          </div>
          {#if desktopState.sessionState?.thinkingLevel}
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span class="text-muted-foreground">Thinking</span>
              <span class="font-medium capitalize">{desktopState.sessionState.thinkingLevel}</span>
            </div>
          {/if}
        </div>
      {:else if desktopState.piStatus.diagnostic}
        <p class="text-[11px] text-destructive">{desktopState.piStatus.diagnostic}</p>
      {/if}
    </SettingsSection>

    <Separator />

    <SettingsSection
      id="data"
      title="Data"
      description="Local recents and session index stored in H3Code. This does not delete PI session files on disk."
    >
      {#if desktopState.repos.length > 0}
        <ul class="divide-y divide-border/50 rounded-lg border border-border/50">
          {#each desktopState.repos as repo (repo.path)}
            <li class="flex items-center gap-3 px-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">{repo.name}</p>
                <p class="truncate font-mono text-[10px] text-muted-foreground">{repo.path}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 shrink-0 text-[11px] text-muted-foreground hover:text-destructive"
                onclick={() => requestRemoveRepo({ name: repo.name, path: repo.path })}
              >
                Remove
              </Button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-xs text-muted-foreground">No indexed repositories yet.</p>
      {/if}

      <div class="flex flex-wrap gap-2">
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

    <Separator />

    <SettingsSection
      id="worktrees"
      title="Worktrees"
      description="H3Code-managed PI worktrees. Dirty worktrees are kept until you review them."
    >
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-8"
          disabled={desktopState.worktreesLoading}
          onclick={() => desktopState.refreshWorktrees()}
        >
          Refresh
        </Button>
        <Button
          variant="destructive"
          size="sm"
          class="h-8"
          disabled={stalePruneableCount === 0 || desktopState.worktreesLoading}
          onclick={() => {
            pruneWorktreesOpen = true;
          }}
        >
          Prune stale
        </Button>
        <span class="text-[11px] text-muted-foreground">
          {stalePruneableCount} removable
        </span>
      </div>

      {#if desktopState.worktreesError}
        <p class="text-xs text-destructive">{desktopState.worktreesError}</p>
      {:else if desktopState.worktreesLoading && desktopState.worktrees.length === 0}
        <p class="text-xs text-muted-foreground">Loading worktrees...</p>
      {:else if worktreeGroups.length === 0}
        <p class="text-xs text-muted-foreground">No H3Code-managed worktrees indexed.</p>
      {:else}
        <div class="space-y-4">
          {#each worktreeGroups as group (group.repoPath)}
            <div class="space-y-2">
              <div class="min-w-0">
                <p class="truncate text-xs font-medium">{group.repoName}</p>
                <p class="truncate font-mono text-[10px] text-muted-foreground">{group.repoPath}</p>
              </div>
              <ul class="divide-y divide-border/50 rounded-lg border border-border/50">
                {#each group.worktrees as worktree (worktree.sessionPath)}
                  <li class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 flex-wrap items-center gap-2">
                        <p class="truncate text-xs font-medium">{getWorktreeTitle(worktree)}</p>
                        <span class="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {getWorktreeStatusLabel(worktree)}
                        </span>
                        <span class="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {getWorktreeDirtyLabel(worktree)}
                        </span>
                      </div>
                      <p class="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={worktree.worktreePath}>
                        {worktree.worktreePath}
                      </p>
                      <p class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" title={worktree.sessionPath}>
                        {worktree.sessionPath}
                      </p>
                    </div>
                    <div class="flex shrink-0 gap-2">
                      {#if worktree.exists}
                        <Button
                          variant="outline"
                          size="sm"
                          class="h-7 text-[11px]"
                          onclick={() => desktopState.revealWorktreePath(worktree.worktreePath)}
                        >
                          Reveal
                        </Button>
                      {/if}
                      {#if worktree.removable}
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                          onclick={() => requestRemoveWorktree(worktree)}
                        >
                          Remove
                        </Button>
                      {/if}
                      {#if worktree.archivable}
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                          onclick={() => requestArchiveWorktree(worktree)}
                        >
                          Archive
                        </Button>
                      {/if}
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}
    </SettingsSection>

    <Separator />

    <SettingsSection id="about" title="About" description="Application and runtime diagnostics.">
      <div class="rounded-lg border border-border/50 bg-muted/30 p-4">
        <dl class="grid gap-3 text-xs">
          <div class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Version</dt>
            <dd class="font-medium">{appVersion}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Platform</dt>
            <dd class="font-medium">{desktopState.platform}</dd>
          </div>
          <div class="flex items-start justify-between gap-4">
            <dt class="shrink-0 text-muted-foreground">Preferences DB</dt>
            <dd class="max-w-md truncate text-right font-mono text-[11px] font-medium">
              {desktopState.preferencesDatabasePath ?? "Loading…"}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Indexed repos</dt>
            <dd class="font-medium">{desktopState.repos.length}</dd>
          </div>
          {#if desktopState.piStatus.diagnostic && !sessionConnected}
            <div class="flex items-start justify-between gap-4">
              <dt class="shrink-0 text-muted-foreground">Diagnostic</dt>
              <dd class="max-w-md text-right text-muted-foreground">{desktopState.piStatus.diagnostic}</dd>
            </div>
          {/if}
        </dl>
      </div>
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

<ConfirmDeleteDialog
  bind:open={worktreeRemovalOpen}
  title="Remove clean stale worktree?"
  description={worktreeRemovalTarget
    ? `Remove the clean stale H3Code worktree at ${worktreeRemovalTarget.worktreePath}. Dirty worktrees and session-associated worktrees are kept.`
    : ""}
  confirmLabel="Remove"
  busy={worktreeRemovalBusy}
  onConfirm={confirmRemoveWorktree}
/>

<ConfirmDeleteDialog
  bind:open={worktreeArchiveOpen}
  title="Archive clean worktree?"
  description={worktreeArchiveTarget
    ? `Stop PI if needed, remove the clean H3Code worktree at ${worktreeArchiveTarget.worktreePath}, and keep the PI session. Reopening the session will create a fresh worktree.`
    : ""}
  confirmLabel="Archive"
  busy={worktreeArchiveBusy}
  onConfirm={confirmArchiveWorktree}
/>

<ConfirmDeleteDialog
  bind:open={pruneWorktreesOpen}
  title="Prune stale worktrees?"
  description={`Remove ${stalePruneableCount} clean stale H3Code worktree ${stalePruneableCount === 1 ? "entry" : "entries"}. Dirty worktrees are kept.`}
  confirmLabel="Prune"
  busy={pruneWorktreesBusy}
  onConfirm={confirmPruneWorktrees}
/>
