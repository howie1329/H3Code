<script lang="ts">
  import PageShell from "$lib/components/desktop/PageShell.svelte";
  import SessionLanding from "$lib/components/desktop/SessionLanding.svelte";
</script>

<svelte:head>
  <title>New session · H3Code Desktop</title>
  <meta name="description" content="Start a new Pi session in H3Code Desktop." />
</svelte:head>

<PageShell header="none">
  <SessionLanding />
</PageShell>
