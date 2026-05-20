<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import AppSidebar from '$lib/components/app-sidebar.svelte';
  import * as Sidebar from '$lib/components/ui/sidebar';
  import { initializeSessionEventListeners, loadRepositories } from '$lib/state/repositories.svelte';

  let { children } = $props();

  onMount(() => {
    initializeSessionEventListeners();
    void loadRepositories();
  });
</script>

<Sidebar.Provider>
  <AppSidebar />
  <Sidebar.Inset class="min-w-0 bg-background text-foreground">
    {@render children()}
  </Sidebar.Inset>
</Sidebar.Provider>
