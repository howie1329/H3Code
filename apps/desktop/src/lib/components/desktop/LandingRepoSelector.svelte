<script lang="ts">
  import { ArrowDown01Icon, FolderAddIcon, FolderCodeIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState } from "$lib/desktop-state.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { cn } from "$lib/utils";

  type Props = {
    disabled?: boolean;
  };

  let { disabled = false }: Props = $props();

  let open = $state(false);

  const repoOptions = $derived(desktopState.repos);
  const label = $derived(
    desktopState.landingRepoName ?? (repoOptions.length === 0 ? "Repository" : "Repository"),
  );

  const triggerClass = $derived(
    cn(
      "inline-flex h-7 max-w-[14rem] shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] leading-tight font-medium shadow-none",
      "text-muted-foreground transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
      "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      "disabled:pointer-events-none disabled:opacity-50",
      open && "bg-accent text-foreground",
    ),
  );

  async function handleAddRepository() {
    await desktopState.addRepoFromLanding();
  }
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger
    type="button"
    {disabled}
    class={triggerClass}
    aria-label="Select repository"
    title={desktopState.landingRepoPath ?? "Select repository"}
  >
    <span class="truncate">{label}</span>
    <HugeiconsIcon icon={ArrowDown01Icon} class="size-2.5 shrink-0 opacity-40" data-icon />
  </DropdownMenu.Trigger>

  <DropdownMenu.Content
    side="top"
    align="start"
    sideOffset={8}
    class="!w-auto min-w-64 max-w-80 shadow-none ring-1 ring-border/50"
  >
    <DropdownMenu.Group>
      <DropdownMenu.GroupHeading
        class="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        Repository
      </DropdownMenu.GroupHeading>
      {#if repoOptions.length === 0}
        <div class="px-2 py-2 text-xs text-muted-foreground">No repositories yet.</div>
      {:else}
        <DropdownMenu.RadioGroup
          value={desktopState.landingRepoPath ?? ""}
          onValueChange={(value) => {
            desktopState.landingRepoPath = value || undefined;
          }}
        >
          {#each repoOptions as repo (repo.path)}
            <DropdownMenu.RadioItem value={repo.path} class="items-start py-2">
              <HugeiconsIcon icon={FolderCodeIcon} class="mt-0.5 size-3 shrink-0 text-muted-foreground" data-icon />
              <span class="min-w-0 flex-1 text-left">
                <span class="block truncate text-xs font-medium leading-tight text-foreground">{repo.name}</span>
                <span
                  class="mt-0.5 block truncate font-mono text-[10px] leading-tight text-muted-foreground"
                  title={repo.path}
                >
                  {repo.path}
                </span>
              </span>
            </DropdownMenu.RadioItem>
          {/each}
        </DropdownMenu.RadioGroup>
      {/if}
    </DropdownMenu.Group>

    <DropdownMenu.Separator />

    <DropdownMenu.Item
      class="gap-2"
      onSelect={() => {
        void handleAddRepository();
      }}
    >
      <HugeiconsIcon icon={FolderAddIcon} class="size-3.5 shrink-0 text-muted-foreground" data-icon />
      <span>Add repository…</span>
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
