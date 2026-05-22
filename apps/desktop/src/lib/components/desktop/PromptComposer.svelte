<script lang="ts">
  import { ArrowUp02Icon, StopCircleIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState } from "$lib/desktop-state.svelte";
  import {
    PromptInput,
    PromptInputBody,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
</script>

<div class="border-t border-border/50 px-4 py-3">
  <PromptInput
    onSubmit={(message, event) => desktopState.handlePromptSubmit(message, event)}
    class="flex min-h-24 flex-col rounded-md border border-border/50 bg-background shadow-none focus-within:ring-2 focus-within:ring-ring/30"
  >
    <PromptInputBody>
      <label for="prompt" class="sr-only">Prompt</label>
      <PromptInputTextarea
        id="prompt"
        bind:value={desktopState.promptValue}
        class="min-h-16 px-3 py-2 text-xs leading-5 placeholder:text-muted-foreground"
        placeholder={desktopState.canUseSession ? "Ask PI to inspect this repo, implement a change, or explain the current state..." : "Select a repo and PI session first..."}
        disabled={!desktopState.canUseSession || desktopState.isBusy}
      />
    </PromptInputBody>
    <PromptInputToolbar class="flex h-9 items-center justify-between border-t border-border/50 px-2">
      <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline">{desktopState.sessionState?.isStreaming ? "Follow-up" : "Prompt"}</Badge>
        <span>Enter to send · Shift+Enter newline</span>
      </div>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" class="text-muted-foreground" onclick={() => desktopState.handleAbort()} disabled={!desktopState.sessionState?.isStreaming || desktopState.isBusy}>
          <HugeiconsIcon icon={StopCircleIcon} data-icon="inline-start" />
          Abort
        </Button>
        <PromptInputSubmit class="h-6 gap-1 px-2 text-xs" disabled={!desktopState.canSubmit}>
          <HugeiconsIcon icon={ArrowUp02Icon} data-icon="inline-start" />
          Send
        </PromptInputSubmit>
      </div>
    </PromptInputToolbar>
  </PromptInput>
</div>
