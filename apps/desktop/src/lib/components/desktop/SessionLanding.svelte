<script lang="ts">
  import { onMount, tick } from "svelte";
  import { AlertCircleIcon, ArrowUp02Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import {
    PromptInput,
    PromptInputSubmit,
    PromptInputTextarea,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import LandingRepoSelector from "$lib/components/desktop/LandingRepoSelector.svelte";
  import PromptComposerField from "$lib/components/desktop/PromptComposerField.svelte";
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
    <div class="relative w-full max-w-3xl">
      <div class="mb-6 space-y-1 text-center">
        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">New session</p>
        <h1 class="text-xl font-semibold leading-tight text-foreground">What should Pi work on?</h1>
      </div>

      {#if desktopState.errorMessage}
        <div
          class="mb-3 flex items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive"
          role="alert"
          aria-live="assertive"
        >
          <HugeiconsIcon icon={AlertCircleIcon} data-icon class="mt-0.5 size-3 shrink-0" />
          <span>{desktopState.errorMessage}</span>
        </div>
      {/if}

      <PromptInput
        onSubmit={(message, event) => handleLandingSubmit(message, event)}
        class="w-full overflow-visible rounded-none border-0 bg-transparent shadow-none"
      >
        <PromptComposerField layout="stacked">
          {#snippet input()}
            <label for="landing-prompt" class="sr-only">Prompt</label>
            <PromptInputTextarea
              id="landing-prompt"
              bind:ref={textareaRef}
              bind:value={desktopState.landingPromptValue}
              class="min-h-24! w-full resize-none border-none bg-transparent p-0 text-xs leading-snug text-foreground shadow-none placeholder:text-xs placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={desktopState.landingRepoPath
                ? `Ask Pi about ${desktopState.landingRepoName ?? "this repo"}…`
                : "Describe what you want Pi to do…"}
              title="Enter to start session and send"
              disabled={!desktopState.landingRepoPath || isSubmitting}
            />
          {/snippet}

          {#snippet footer()}
            <LandingRepoSelector disabled={isSubmitting} />
          {/snippet}

          {#snippet trailing()}
            <PromptInputSubmit
              variant={desktopState.canSubmitLanding ? "default" : "ghost"}
              size="icon"
              data-prompt-input-submit
              class="size-7 shrink-0 rounded-full shadow-none transition-[background-color,color,opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 {desktopState.canSubmitLanding
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-muted-foreground/55 hover:text-muted-foreground'}"
              title="Start session"
              disabled={!desktopState.canSubmitLanding}
            >
              <HugeiconsIcon icon={ArrowUp02Icon} data-icon />
            </PromptInputSubmit>
          {/snippet}
        </PromptComposerField>
      </PromptInput>

      <p class="mt-2 text-center text-[11px] leading-tight text-muted-foreground">
        <Kbd.Kbd>Enter</Kbd.Kbd>
        <span class="px-1">starts a session and sends your prompt</span>
      </p>
    </div>
  </main>
</div>
