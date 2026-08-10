<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";

  let repositoryPath = $state<string | null>(null);

  async function chooseRepository() {
    const repository = await window.h3code?.selectRepository();

    if (repository) {
      repositoryPath = repository.path;
    }
  }
</script>

<svelte:head>
  <title>H3Code</title>
  <meta name="description" content="A focused desktop workbench for PI." />
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-8 py-16">
  <div class="flex flex-col gap-3">
    <p class="text-sm font-medium text-muted-foreground">H3Code</p>
    <h1 class="text-3xl font-semibold tracking-tight">A clean foundation for PI.</h1>
    <p class="max-w-xl text-base leading-7 text-muted-foreground">
      The previous workbench has been removed. This baseline keeps Electron, Svelte, Tailwind CSS,
      and fresh shadcn components so the PI workflow can be rebuilt one vertical slice at a time.
    </p>
  </div>

  <div class="flex flex-col items-start gap-3">
    <Button onclick={chooseRepository}>Choose repository</Button>

    {#if repositoryPath}
      <p class="max-w-full truncate text-sm text-muted-foreground" title={repositoryPath}>
        {repositoryPath}
      </p>
    {/if}
  </div>
</main>
