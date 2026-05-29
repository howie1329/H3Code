<script lang="ts">
  import { FileDiffIcon, PanelRightCloseIcon, PanelRightOpenIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import ContextPanel from "$lib/components/desktop/ContextPanel.svelte";
  import PageShell from "$lib/components/desktop/PageShell.svelte";
  import PromptComposer from "$lib/components/desktop/PromptComposer.svelte";
  import SessionDiffPanel from "$lib/components/desktop/SessionDiffPanel.svelte";
  import WorkspaceTranscript from "$lib/components/desktop/WorkspaceTranscript.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { desktopState } from "$lib/desktop-state.svelte";

  const activeInspector = $derived(desktopState.activeInspector);
  const contextToggleLabel = $derived(
    activeInspector === "context" ? "Hide context panel" : "Show context panel"
  );
  const diffToggleLabel = $derived(activeInspector === "diff" ? "Hide session diff" : "Show session diff");

  function toggleContextPanel() {
    desktopState.toggleContextPanel();
  }

  function toggleDiffPanel() {
    desktopState.toggleSessionDiffPanel();
  }
</script>

<PageShell>
  {#snippet actions()}
    {#if desktopState.hasSessionDiff}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={diffToggleLabel}
        aria-pressed={activeInspector === "diff"}
        title={diffToggleLabel}
        onclick={toggleDiffPanel}
      >
        <HugeiconsIcon icon={FileDiffIcon} data-icon />
      </Button>
    {/if}
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={contextToggleLabel}
      aria-pressed={activeInspector === "context"}
      title={contextToggleLabel}
      onclick={toggleContextPanel}
    >
      <HugeiconsIcon icon={activeInspector === "context" ? PanelRightCloseIcon : PanelRightOpenIcon} data-icon />
    </Button>
  {/snippet}

  <div class="flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden">
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <WorkspaceTranscript>
        <PromptComposer floating />
      </WorkspaceTranscript>
    </div>

    {#if activeInspector === "diff"}
      <SessionDiffPanel />
    {:else if activeInspector === "context"}
      <ContextPanel />
    {/if}
  </div>
</PageShell>
