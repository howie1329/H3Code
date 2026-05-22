<script lang="ts">
  import ContextPanel from "$lib/components/desktop/ContextPanel.svelte";
  import PromptComposer from "$lib/components/desktop/PromptComposer.svelte";
  import WorkspaceTranscript from "$lib/components/desktop/WorkspaceTranscript.svelte";
</script>

<svelte:head>
  <title>Workspace · H3Code Desktop</title>
  <meta name="description" content="H3Code PI workspace." />
</svelte:head>

<div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_24rem]">
  <WorkspaceTranscript>
    <PromptComposer />
  </WorkspaceTranscript>

  <ContextPanel />
</div>
