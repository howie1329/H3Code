<script lang="ts">
  import { page } from '$app/state';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    BubbleChatFreeIcons,
    FolderGitFreeIcons,
    PlusSignFreeIcons,
    Settings02FreeIcons,
    Tick02FreeIcons,
    Cancel01FreeIcons
  } from '@hugeicons/core-free-icons';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Sidebar from '$lib/components/ui/sidebar';
  import {
    addRepository,
    createSession,
    openCreateSession,
    pickRepositoryDirectory,
    renameSession,
    repositoryState,
    selectRepository,
    selectSession,
    startRenamingSession
  } from '$lib/state/repositories.svelte';

  const iconSize = 12;

  $: settingsActive = page.url.pathname === '/settings';
  $: canSubmitRepo = repositoryState.repoPathInput.trim().length > 0 && !repositoryState.isAddingRepo;
  $: canSubmitSession = !!repositoryState.selectedRepo && !repositoryState.isCreatingSession;
</script>

<Sidebar.Root collapsible="icon" class="border-sidebar-border">
  <Sidebar.Header class="gap-2 px-2 py-3">
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="lg" tooltipContent="H3 Code" class="h-9 px-2">
          <div class="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
            H3
          </div>
          <span class="text-sm font-semibold leading-tight">H3 Code</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>

  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Repos</Sidebar.GroupLabel>
      <Sidebar.GroupAction
        aria-label="Add repository"
        title="Add repository"
        onclick={() => (repositoryState.isAddRepoOpen = !repositoryState.isAddRepoOpen)}
      >
        <HugeiconsIcon icon={PlusSignFreeIcons} size={12} color="currentColor" />
      </Sidebar.GroupAction>

      <Sidebar.GroupContent class="space-y-2">
        {#if repositoryState.isAddRepoOpen}
          <form
            class="space-y-2 px-2 group-data-[collapsible=icon]:hidden"
            onsubmit={(event) => {
              event.preventDefault();
              void addRepository();
            }}
          >
            <div class="space-y-1.5">
              <Label class="text-[11px]" for="repo-path">Repository path</Label>
              <Input
                id="repo-path"
                class="h-8 bg-background text-xs"
                placeholder="/path/to/repository"
                bind:value={repositoryState.repoPathInput}
                disabled={repositoryState.isAddingRepo}
                aria-invalid={repositoryState.repoError ? 'true' : undefined}
              />
            </div>

            <div class="flex gap-2">
              <Button
                class="h-8 flex-1 px-2 text-xs"
                variant="outline"
                type="button"
                onclick={pickRepositoryDirectory}
                disabled={repositoryState.isPickingRepoDirectory || repositoryState.isAddingRepo}
              >
                {repositoryState.isPickingRepoDirectory ? 'Browsing...' : 'Browse...'}
              </Button>

              <Button class="h-8 flex-1 px-2 text-xs" type="submit" disabled={!canSubmitRepo}>
                {repositoryState.isAddingRepo ? 'Adding...' : 'Add'}
              </Button>
            </div>

            {#if repositoryState.repoError}
              <p class="text-xs leading-snug text-destructive">{repositoryState.repoError}</p>
            {/if}
          </form>
        {/if}

        {#if repositoryState.isLoadingRepos}
          <div class="px-2.5 text-xs leading-7 text-muted-foreground group-data-[collapsible=icon]:hidden">
            Loading repos...
          </div>
        {:else if repositoryState.repos.length === 0}
          <div class="px-2.5 text-xs leading-snug text-muted-foreground group-data-[collapsible=icon]:hidden">
            No repositories yet. Add a local folder to get started.
          </div>
        {:else}
          <Sidebar.Menu>
            {#each repositoryState.repos as repo}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  size="sm"
                  isActive={repositoryState.selectedRepo?.id === repo.id}
                  tooltipContent={repo.name}
                  class="h-auto min-h-7 items-start py-1.5"
                  onclick={() => selectRepository(repo)}
                  aria-disabled={repositoryState.isSelectingRepoId === repo.id ? 'true' : undefined}
                  aria-current={repositoryState.selectedRepo?.id === repo.id ? 'page' : undefined}
                >
                  <HugeiconsIcon icon={FolderGitFreeIcons} size={iconSize} color="currentColor" />
                  <span class="min-w-0 leading-tight">
                    <span class="block truncate">{repo.name}</span>
                    <span class="block truncate text-[11px] font-normal text-muted-foreground group-data-[collapsible=icon]:hidden">
                      {repo.path}
                    </span>
                  </span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        {/if}
      </Sidebar.GroupContent>
    </Sidebar.Group>

    <Sidebar.Group>
      <Sidebar.GroupLabel>Sessions</Sidebar.GroupLabel>
      {#if repositoryState.selectedRepo}
        <Sidebar.GroupAction aria-label="Create session" title="Create session" onclick={openCreateSession}>
          <HugeiconsIcon icon={PlusSignFreeIcons} size={12} color="currentColor" />
        </Sidebar.GroupAction>
      {/if}

      <Sidebar.GroupContent class="space-y-2">
        {#if repositoryState.isCreateSessionOpen && repositoryState.selectedRepo}
          <form
            class="space-y-2 px-2 group-data-[collapsible=icon]:hidden"
            onsubmit={(event) => {
              event.preventDefault();
              void createSession();
            }}
          >
            <div class="space-y-1.5">
              <Label class="text-[11px]" for="session-title">Session title (optional)</Label>
              <Input
                id="session-title"
                class="h-8 bg-background text-xs"
                placeholder="Pi can name this later"
                bind:value={repositoryState.sessionTitleInput}
                disabled={repositoryState.isCreatingSession}
                aria-invalid={repositoryState.sessionError ? 'true' : undefined}
              />
            </div>

            <div class="flex gap-2">
              <Button
                class="h-8 flex-1 px-2 text-xs"
                type="submit"
                disabled={!canSubmitSession}
              >
                <HugeiconsIcon icon={Tick02FreeIcons} size={12} color="currentColor" />
                {repositoryState.isCreatingSession ? 'Creating...' : 'Create'}
              </Button>
              <Button
                class="h-8 px-2 text-xs"
                variant="outline"
                type="button"
                disabled={repositoryState.isCreatingSession}
                onclick={() => {
                  repositoryState.isCreateSessionOpen = false;
                  repositoryState.sessionError = '';
                }}
                aria-label="Cancel session creation"
              >
                <HugeiconsIcon icon={Cancel01FreeIcons} size={12} color="currentColor" />
              </Button>
            </div>

            {#if repositoryState.sessionError}
              <p class="text-xs leading-snug text-destructive">{repositoryState.sessionError}</p>
            {/if}
          </form>
        {/if}

        {#if !repositoryState.selectedRepo}
          <div class="px-2.5 text-xs leading-snug text-muted-foreground group-data-[collapsible=icon]:hidden">
            Select a repo to view sessions.
          </div>
        {:else if repositoryState.isLoadingSessions}
          <div class="px-2.5 text-xs leading-7 text-muted-foreground group-data-[collapsible=icon]:hidden">
            Loading sessions...
          </div>
        {:else if repositoryState.sessions.length === 0}
          <div class="px-2.5 text-xs leading-snug text-muted-foreground group-data-[collapsible=icon]:hidden">
            No sessions yet.
          </div>
        {:else}
          <Sidebar.Menu>
            {#each repositoryState.sessions as session}
              <Sidebar.MenuItem>
                {#if repositoryState.editingSessionTitleId === session.id}
                  <form
                    class="space-y-1 px-2 group-data-[collapsible=icon]:hidden"
                    onsubmit={(event) => {
                      event.preventDefault();
                      void renameSession(session);
                    }}
                  >
                    <Input
                      class="h-8 bg-background text-xs"
                      bind:value={repositoryState.renameTitleInput}
                      disabled={repositoryState.isRenamingSession}
                      aria-label="Session title"
                    />
                    <div class="flex gap-1">
                      <Button class="h-7 flex-1 px-2 text-xs" type="submit" disabled={repositoryState.isRenamingSession}>
                        Save
                      </Button>
                      <Button
                        class="h-7 px-2 text-xs"
                        variant="outline"
                        type="button"
                        onclick={() => (repositoryState.editingSessionTitleId = '')}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                {:else}
                  <div class="flex items-start gap-1">
                    <Sidebar.MenuButton
                      size="sm"
                      isActive={repositoryState.selectedSession?.id === session.id}
                      tooltipContent={session.title}
                      class="h-auto min-h-7 flex-1 items-start py-1.5"
                      onclick={() => selectSession(session)}
                      aria-disabled={repositoryState.isSelectingSessionId === session.id ? 'true' : undefined}
                      aria-current={repositoryState.selectedSession?.id === session.id ? 'page' : undefined}
                    >
                      <HugeiconsIcon icon={BubbleChatFreeIcons} size={iconSize} color="currentColor" />
                      <span class="min-w-0 leading-tight">
                        <span class="block truncate">{session.title}</span>
                        <span class="block truncate text-[11px] font-normal text-muted-foreground group-data-[collapsible=icon]:hidden">
                          {session.status} · {session.harness}
                        </span>
                      </span>
                    </Sidebar.MenuButton>
                    <Button
                      class="mt-0.5 h-6 px-1.5 text-[10px] group-data-[collapsible=icon]:hidden"
                      variant="ghost"
                      type="button"
                      onclick={() => startRenamingSession(session)}
                    >
                      Rename
                    </Button>
                  </div>
                {/if}
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        {/if}
      </Sidebar.GroupContent>
    </Sidebar.Group>

    <Sidebar.Group>
      <Sidebar.GroupLabel>Settings</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton size="sm" isActive={settingsActive} tooltipContent="Settings">
              {#snippet child({ props })}
                <a href="/settings" {...props}>
                  <HugeiconsIcon icon={Settings02FreeIcons} size={iconSize} color="currentColor" />
                  <span>Pi executable</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>

  <Sidebar.Footer class="px-2 py-3 group-data-[collapsible=icon]:hidden">
    <div class="px-2 text-[11px] text-muted-foreground">Pi Desk scaffold</div>
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
