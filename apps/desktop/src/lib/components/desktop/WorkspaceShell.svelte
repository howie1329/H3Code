<script lang="ts">
  import { FileDiffIcon, PanelRightCloseIcon, PanelRightOpenIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import AppHeader from "$lib/components/desktop/AppHeader.svelte";
  import ContextPanel from "$lib/components/desktop/ContextPanel.svelte";
  import PromptComposer from "$lib/components/desktop/PromptComposer.svelte";
  import SessionDiffPanel from "$lib/components/desktop/SessionDiffPanel.svelte";
  import WorkspaceTranscript from "$lib/components/desktop/WorkspaceTranscript.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { desktopState } from "$lib/desktop-state.svelte";

  const isContextPanelOpen = $derived(desktopState.desktopSettings.contextPanelOpen);
  const isDiffPanelOpen = $derived(desktopState.sessionDiffPanelOpen && desktopState.hasSessionDiff);
  const toggleLabel = $derived(isContextPanelOpen ? "Hide context panel" : "Show context panel");
  const diffToggleLabel = $derived(isDiffPanelOpen ? "Hide session diff" : "Show session diff");

  function getWorkspaceGridTemplate() {
    const columns = ["minmax(0,1fr)"];

    if (isDiffPanelOpen) {
      columns.push("minmax(20rem,32rem)");
    }

    if (isContextPanelOpen) {
      columns.push("var(--context-panel-width)");
    }

    return columns.join(" ");
  }
</script>

<AppHeader>
  {#snippet actions()}
    {#if desktopState.hasSessionDiff}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={diffToggleLabel}
        aria-pressed={isDiffPanelOpen}
        title={diffToggleLabel}
        onclick={() => desktopState.setSessionDiffPanelOpen(!isDiffPanelOpen)}
      >
        <HugeiconsIcon icon={FileDiffIcon} data-icon />
      </Button>
    {/if}
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={toggleLabel}
      aria-pressed={isContextPanelOpen}
      title={toggleLabel}
      onclick={() => desktopState.setContextPanelOpen(!isContextPanelOpen)}
    >
      <HugeiconsIcon icon={isContextPanelOpen ? PanelRightCloseIcon : PanelRightOpenIcon} data-icon />
    </Button>
  {/snippet}
</AppHeader>

<div class="grid min-h-0 flex-1 overflow-hidden" style:grid-template-columns={getWorkspaceGridTemplate()}>
  <WorkspaceTranscript>
    <PromptComposer />
  </WorkspaceTranscript>

  {#if isDiffPanelOpen}
    <SessionDiffPanel />
  {/if}

  {#if isContextPanelOpen}
    <ContextPanel />
  {/if}
</div>
