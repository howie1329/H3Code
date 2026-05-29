<script lang="ts">
  import { onMount, tick } from "svelte";
  import { AlertCircleIcon, ArrowUp02Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import {
    PromptInput,
    PromptInputBody,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
    PromptInputTools,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import LandingRepoSelector from "$lib/components/desktop/LandingRepoSelector.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import * as Kbd from "$lib/components/ui/kbd/index.js";

  let textareaRef = $state<HTMLTextAreaElement | null>(null);

  const isSubmitting = $derived(desktopState.isBusy || desktopState.isSendingPrompt);

  onMount(() => {
    const focusComposer = () => {
      void tick().then(() => textareaRef?.focus());
    };

    focusComposer();
    window.addEventListener("h3code:focus-landing-composer", focusComposer);

    return () => {
      window.removeEventListener("h3code:focus-landing-composer", focusComposer);
    };
  });

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
      <div class="mb-8 space-y-1 text-center">
        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">New session</p>
        <h1 class="text-xl font-semibold leading-tight text-foreground">What should Pi work on?</h1>
      </div>

      {#if desktopState.errorMessage}
        <div
          class="mb-3 flex items-start gap-2 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
          aria-live="assertive"
        >
          <HugeiconsIcon icon={AlertCircleIcon} data-icon class="mt-0.5 size-3 shrink-0" />
          <span>{desktopState.errorMessage}</span>
        </div>
      {/if}

      <PromptInput onSubmit={(message, event) => handleLandingSubmit(message, event)} class="w-full">
        <PromptInputBody>
          <label for="landing-prompt" class="sr-only">Prompt</label>
          <PromptInputTextarea
            id="landing-prompt"
            bind:ref={textareaRef}
            bind:value={desktopState.landingPromptValue}
            placeholder={desktopState.landingRepoPath
              ? `Ask Pi about ${desktopState.landingRepoName ?? "this repo"}…`
              : "Describe what you want Pi to do…"}
            title="Enter to start session and send"
            disabled={!desktopState.landingRepoPath || isSubmitting}
          />
        </PromptInputBody>

        <PromptInputToolbar>
          <PromptInputTools>
            <LandingRepoSelector disabled={isSubmitting} />
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

      <p class="mt-3 text-center text-[11px] leading-tight text-muted-foreground">
        <Kbd.Kbd>Enter</Kbd.Kbd>
        <span class="px-1">starts session</span>
      </p>
    </div>
  </main>
</div>
