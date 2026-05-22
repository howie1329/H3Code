<script lang="ts">
  import { AlertCircleIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState } from "$lib/desktop-state.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
</script>

<aside class="flex min-w-0 flex-col border-l border-border bg-background">
  <header class="flex h-10 items-center justify-between border-b border-border/50 px-4">
    <h2 class="text-xs font-semibold">Context</h2>
    <Badge variant="secondary">PI</Badge>
  </header>

  <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-4">
    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current repo</h3>
      <div class="flex items-center justify-between gap-2 text-xs">
        <span class="min-w-0">
          <span class="block truncate font-medium">{desktopState.repoName}</span>
          <span class="block truncate font-mono text-[10px] text-muted-foreground">{desktopState.repoPath ?? "None"}</span>
        </span>
        <Badge variant="outline">{desktopState.repoPath ? "Selected" : "Empty"}</Badge>
      </div>
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session</h3>
      <div class="grid gap-2 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted-foreground">State</span>
          <span class="font-medium">{desktopState.sessionState?.isStreaming ? "Running" : "Idle"}</span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted-foreground">Messages</span>
          <span class="font-medium">{desktopState.sessionState?.messageCount ?? desktopState.messages.length}</span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted-foreground">Thinking</span>
          <span class="font-medium">{desktopState.sessionState?.thinkingLevel ?? "Unknown"}</span>
        </div>
      </div>
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Runtime diagnostics</h3>
      <div class="grid gap-2 text-xs">
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">PI RPC</span>
          <span class="truncate text-right font-medium">{desktopState.piStatus.state}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Executable</span>
          <span class="truncate text-right font-medium">pi</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Working dir</span>
          <span class="truncate text-right font-medium">{desktopState.repoPath ?? "None"}</span>
        </div>
        {#if desktopState.piStatus.diagnostic}
          <div class="text-muted-foreground">{desktopState.piStatus.diagnostic}</div>
        {/if}
      </div>
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tool activity</h3>
      <div class="flex flex-col gap-1">
        {#if desktopState.activity.length === 0}
          <div class="px-2 py-1 text-xs text-muted-foreground">No activity yet</div>
        {:else}
          {#each desktopState.activity as event}
            <div class="flex h-8 items-center justify-between gap-2 rounded-md px-2 text-xs hover:bg-accent">
              <span class="flex min-w-0 items-center gap-2">
                <HugeiconsIcon icon={AlertCircleIcon} data-icon />
                <span class="truncate font-mono text-[11px]">{event.detail}</span>
              </span>
              <span class="text-[11px] text-muted-foreground">{event.type}</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  </div>
</aside>
