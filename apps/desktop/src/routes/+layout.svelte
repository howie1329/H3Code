<script lang="ts">
  import { onMount } from "svelte";

  import AppSidebar from "$lib/components/desktop/AppSidebar.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import "../app.css";

  let { children } = $props();

  onMount(() => {
    const cleanup = desktopState.initializeListeners();
    void desktopState.initializePreferences();

    return cleanup;
  });
</script>

<Sidebar.Provider
  open={desktopState.desktopSettings.sidebarOpen}
  onOpenChange={(open) => desktopState.setSidebarOpen(open)}
  class="h-screen min-h-0 overflow-hidden bg-background text-foreground"
>
  <AppSidebar />

  <Sidebar.Inset class="min-w-0 overflow-hidden">
    {@render children()}
  </Sidebar.Inset>
</Sidebar.Provider>
