<script lang="ts">
  import { browser } from "$app/environment";
  import type { FileDiff, FileDiffMetadata } from "@pierre/diffs";
  import { mode } from "mode-watcher";

  import { Button } from "$lib/components/ui/button/index.js";
  import { desktopState } from "$lib/desktop-state.svelte";

  let container = $state<HTMLElement>();
  let renderError = $state<string | undefined>();
  let fileCount = $state(0);

  function getThemeType() {
    return mode.current === "light" || mode.current === "dark" ? mode.current : "system";
  }

  $effect(() => {
    const patch = desktopState.sessionDiff.patch;
    const themeType = getThemeType();

    if (!browser || !container) {
      return;
    }

    let cancelled = false;
    const instances: FileDiff[] = [];

    async function renderDiff() {
      renderError = undefined;
      container!.replaceChildren();

      if (!patch.trim()) {
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
          container!.append(wrapper);

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
        {#if desktopState.sessionDiffLoading}
          Refreshing changes
        {:else if renderError || desktopState.sessionDiffError}
          Diff unavailable
        {:else}
          {fileCount || desktopState.sessionDiff.changedFiles} changed {(fileCount || desktopState.sessionDiff.changedFiles) === 1 ? "file" : "files"}
        {/if}
      </p>
    </div>
    <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" disabled={desktopState.sessionDiffLoading} onclick={() => desktopState.refreshSessionDiff()}>
      Refresh
    </Button>
  </div>

  {#if renderError || desktopState.sessionDiffError}
    <div class="p-3 text-xs leading-5 text-muted-foreground">{renderError ?? desktopState.sessionDiffError}</div>
  {:else if desktopState.sessionDiffLoading && !desktopState.sessionDiff.patch}
    <div class="p-3 text-xs text-muted-foreground">Loading diff...</div>
  {:else}
    <div bind:this={container} class="session-diff-container min-h-0 flex-1 overflow-auto p-2"></div>
  {/if}
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
