<script lang="ts">
  import WorkspaceShell from "$lib/components/desktop/WorkspaceShell.svelte";
</script>

<svelte:head>
  <title>Workspace · H3Code Desktop</title>
  <meta name="description" content="H3Code PI workspace." />
</svelte:head>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
  <WorkspaceShell />
</div>
