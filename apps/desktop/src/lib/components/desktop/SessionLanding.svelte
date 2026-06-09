<script lang="ts">
  import { onMount, tick } from "svelte";
  import { AlertCircleIcon, ArrowUp02Icon, FolderAddIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import {
    PromptInput,
    PromptInputBody,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
    PromptInputTools,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import LandingModelSelector from "$lib/components/desktop/LandingModelSelector.svelte";
  import LandingRepoSelector from "$lib/components/desktop/LandingRepoSelector.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Kbd from "$lib/components/ui/kbd/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";

  let textareaRef = $state<HTMLTextAreaElement | null>(null);

  const isSubmitting = $derived(desktopState.isBusy || desktopState.isSendingPrompt);
  const isLoadingPrefs = $derived(!desktopState.preferencesLoaded);
  const hasRepos = $derived(desktopState.repos.length > 0);
  const hasSelectedRepo = $derived(Boolean(desktopState.landingRepoPath));
  const composerDisabled = $derived(
    isLoadingPrefs || !hasRepos || !hasSelectedRepo || isSubmitting,
  );
  const showEnterHint = $derived(hasSelectedRepo && !isLoadingPrefs);

  const promptPlaceholder = $derived.by(() => {
    if (!hasRepos) {
      return "Add a repository to start…";
    }

    if (!hasSelectedRepo) {
      return "Select a repository to continue…";
    }

    return `Ask Pi about ${desktopState.landingRepoName ?? "this repo"}…`;
  });

  async function focusComposerWhenReady() {
    if (composerDisabled) {
      return;
    }

    await tick();
    textareaRef?.focus();
  }

  onMount(() => {
    void focusComposerWhenReady();

    const handleFocusLandingComposer = () => {
      void focusComposerWhenReady();
    };

    window.addEventListener("h3code:focus-landing-composer", handleFocusLandingComposer);

    return () => {
      window.removeEventListener("h3code:focus-landing-composer", handleFocusLandingComposer);
    };
  });

  $effect(() => {
    if (!hasSelectedRepo || isLoadingPrefs) {
      return;
    }

    void focusComposerWhenReady();
  });

  $effect(() => {
    if (isLoadingPrefs) {
      return;
    }

    void desktopState.ensureAvailableModels();
  });

  async function handleAddRepository() {
    await desktopState.addRepoFromLanding();
  }

  async function handleLandingSubmit(message: { text?: string }, event: SubmitEvent) {
    event.preventDefault();

    const repoPath = desktopState.landingRepoPath;
    const text = message.text?.trim() ?? desktopState.landingPromptValue.trim();

    if (!repoPath || !text || isSubmitting) {
      return;
    }

    await desktopState.startSessionFromLanding(repoPath, text);
  }
</script>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
  <main class="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
    <div
      class="relative w-full max-w-xl animate-in fade-in-0 slide-in-from-bottom-1 duration-150 motion-reduce:animate-none motion-reduce:opacity-100"
    >
      <div class="mb-7 text-center">
        <h1 class="text-balance text-xl font-semibold leading-tight text-foreground">
          What should Pi work on?
        </h1>
      </div>

      {#if desktopState.errorMessage}
        <div
          class="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
          aria-live="assertive"
        >
          <HugeiconsIcon icon={AlertCircleIcon} data-icon class="mt-0.5 size-3 shrink-0" />
          <span>{desktopState.errorMessage}</span>
        </div>
      {/if}

      {#if isLoadingPrefs}
        <div class="space-y-2" aria-busy="true" aria-label="Loading workspace">
          <Skeleton class="h-[7.5rem] w-full rounded-lg" />
          <Skeleton class="mx-auto h-3 w-32" />
        </div>
      {:else}
        {#if !hasRepos}
          <div class="mb-5 flex flex-col items-center gap-2 text-center">
            <Button
              type="button"
              class="h-7 gap-1.5 text-xs"
              disabled={isSubmitting}
              onclick={() => void handleAddRepository()}
            >
              <HugeiconsIcon icon={FolderAddIcon} data-icon class="size-3.5" />
              Add repository…
            </Button>
            <p class="max-w-sm text-[11px] leading-snug text-muted-foreground">
              Choose a local folder for Pi to work in.
            </p>
          </div>
        {/if}

        <PromptInput onSubmit={(message, event) => handleLandingSubmit(message, event)} class="w-full">
          <PromptInputBody>
            <label for="landing-prompt" class="sr-only">Prompt</label>
            <PromptInputTextarea
              id="landing-prompt"
              bind:ref={textareaRef}
              bind:value={desktopState.landingPromptValue}
              placeholder={promptPlaceholder}
              title="Enter to start session and send"
              disabled={composerDisabled}
            />
          </PromptInputBody>

          <PromptInputToolbar>
            <PromptInputTools>
              <LandingRepoSelector disabled={isSubmitting || isLoadingPrefs || !hasRepos} />
              <LandingModelSelector disabled={isSubmitting || isLoadingPrefs} />
            </PromptInputTools>

            <PromptInputSubmit
              variant={desktopState.canSubmitLanding ? "default" : "ghost"}
              size="icon"
              data-prompt-input-submit
              title="Start session"
              disabled={!desktopState.canSubmitLanding}
            >
              <HugeiconsIcon icon={ArrowUp02Icon} data-icon class="size-3.5" />
            </PromptInputSubmit>
          </PromptInputToolbar>
        </PromptInput>

        {#if showEnterHint}
          <p class="mt-3.5 text-center text-[11px] leading-tight text-muted-foreground">
            <Kbd.Kbd>Enter</Kbd.Kbd>
            <span class="px-1">starts session</span>
          </p>
        {/if}
      {/if}
    </div>
  </main>
</div>
