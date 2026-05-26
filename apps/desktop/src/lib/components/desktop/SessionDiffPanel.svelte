<script lang="ts">
  import { browser } from "$app/environment";
  import type { FileDiff, FileDiffMetadata } from "@pierre/diffs";
  import { mode } from "mode-watcher";

  import { Button } from "$lib/components/ui/button/index.js";
  import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "$lib/components/ui/empty/index.js";
  import { desktopState } from "$lib/desktop-state.svelte";

  let container = $state<HTMLElement>();
  let renderError = $state<string | undefined>();
  let fileCount = $state(0);

  const patch = $derived(desktopState.sessionDiff.patch);
  const hasPatch = $derived(patch.trim().length > 0);
  const showLoading = $derived(desktopState.sessionDiffLoading && !hasPatch);
  const showError = $derived(Boolean(renderError || desktopState.sessionDiffError));
  const showEmpty = $derived(!showLoading && !showError && !hasPatch);

  function getThemeType() {
    return mode.current === "light" || mode.current === "dark" ? mode.current : "system";
  }

  $effect(() => {
    const themeType = getThemeType();
    const mount = container;

    if (!browser || !mount) {
      return;
    }

    const el = mount;
    let cancelled = false;
    const instances: FileDiff[] = [];

    async function renderDiff() {
      renderError = undefined;
      el.replaceChildren();

      if (!hasPatch) {
        fileCount = 0;
        return;
      }

      try {
        const { FileDiff, parsePatchFiles } = await import("@pierre/diffs");

        if (cancelled) {
          return;
        }

        const files = parsePatchFiles(patch, "session-diff").flatMap((parsedPatch) => parsedPatch.files);
        fileCount = files.length;

        for (const fileDiff of files) {
          const wrapper = document.createElement("div");
          wrapper.className = "session-diff-file";
          el.append(wrapper);

          const instance = new FileDiff({
            diffStyle: "unified",
            hunkSeparators: "line-info",
            overflow: "scroll",
            stickyHeader: true,
            theme: {
              light: "pierre-light",
              dark: "pierre-dark",
            },
            themeType,
          });

          instance.render({
            fileDiff: fileDiff as FileDiffMetadata,
            containerWrapper: wrapper,
          });

          instances.push(instance);
        }
      } catch (error) {
        renderError = error instanceof Error ? error.message : String(error);
      }
    }

    void renderDiff();

    return () => {
      cancelled = true;

      for (const instance of instances) {
        instance.cleanUp();
      }
    };
  });
</script>

<aside
  class="flex h-full max-h-full min-h-0 w-(--context-panel-width) shrink-0 flex-col overflow-hidden border-l border-border/50 bg-background"
  aria-label="Session diff"
>
  <div class="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3">
    <div class="min-w-0">
      <h3 class="truncate text-xs font-medium">Session diff</h3>
      <p class="truncate text-[11px] text-muted-foreground">
        {#if showLoading}
          Refreshing changes
        {:else if showError}
          Diff unavailable
        {:else if showEmpty}
          No uncommitted changes
        {:else}
          {fileCount || desktopState.sessionDiff.changedFiles} changed {(fileCount || desktopState.sessionDiff.changedFiles) === 1 ? "file" : "files"}
        {/if}
      </p>
    </div>
    <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" disabled={desktopState.sessionDiffLoading} onclick={() => desktopState.refreshSessionDiff()}>
      Refresh
    </Button>
  </div>

  {#if showError}
    <div class="p-3 text-xs leading-5 text-muted-foreground">{renderError ?? desktopState.sessionDiffError}</div>
  {:else if showLoading}
    <div class="p-3 text-xs text-muted-foreground">Loading diff...</div>
  {:else if showEmpty}
    <div class="flex min-h-0 flex-1 items-center justify-center p-4">
      <Empty class="border-0 bg-transparent p-0">
        <EmptyHeader>
          <EmptyTitle>No uncommitted changes</EmptyTitle>
          <EmptyDescription>Session diff appears here after PI edits files.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" class="h-7 px-2 text-xs" disabled={desktopState.sessionDiffLoading} onclick={() => desktopState.refreshSessionDiff()}>
            Refresh
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  {/if}

  <div
    bind:this={container}
    class="session-diff-container min-h-0 flex-1 overflow-auto p-2"
    class:hidden={showError || showLoading || showEmpty}
  ></div>
</aside>

<style>
  :global(.session-diff-file) {
    margin-bottom: 0.5rem;
  }

  :global(.session-diff-file > *) {
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    overflow: hidden;
  }
</style>
