<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  import WorkspaceShell from "$lib/components/desktop/WorkspaceShell.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";

  onMount(() => {
    if (desktopState.preferencesLoaded && !desktopState.hasActiveWorkspaceSession) {
      void goto("/");
    }
  });

  $effect(() => {
    if (!desktopState.preferencesLoaded) {
      return;
    }

    if (!desktopState.hasActiveWorkspaceSession && typeof window !== "undefined" && window.location.pathname === "/workspace") {
      void goto("/");
    }
  });
</script>

<svelte:head>
  <title>Workspace · H3Code Desktop</title>
  <meta name="description" content="H3Code PI workspace." />
</svelte:head>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
  <WorkspaceShell />
</div>
