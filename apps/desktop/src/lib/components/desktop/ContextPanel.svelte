<script lang="ts">
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { getActivityIcon } from "$lib/components/desktop/activity-icons.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { getModelLabel, mergeModelWithCatalog, normalizeModel } from "$lib/provider-model.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";

  const sessionStatus = $derived(
    desktopState.isAgentRunning ? "Running" : desktopState.sessionReadModel.status === "error" ? "Error" : "Idle",
  );
  const sessionId = $derived(desktopState.activeSessionId);
  const currentModel = $derived(
    mergeModelWithCatalog(desktopState.sessionReadModel.model, desktopState.availableModels) ??
      normalizeModel(desktopState.sessionReadModel.model),
  );

  function shortId(value: string | undefined) {
    return value ? value.slice(0, 8) : "None";
  }

  function formatCount(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "Unknown";
    }

    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: value < 10_000 ? 1 : 0,
      notation: value >= 10_000 ? "compact" : "standard",
    }).format(value);
  }

  const userMessages = $derived(
    desktopState.sessionReadModel.messages.filter((message) => message.role === "user").length,
  );
  const assistantMessages = $derived(
    desktopState.sessionReadModel.messages.filter((message) => message.role === "assistant").length,
  );
  const toolActivities = $derived(
    desktopState.sessionReadModel.activities.filter((activity) => activity.kind === "tool").length,
  );
</script>

<aside
  class="flex h-full max-h-full min-h-0 w-(--context-panel-width) shrink-0 flex-col overflow-hidden border-l border-border bg-background"
  aria-label="Session context"
>
  <header class="flex h-10 items-center justify-between border-b border-border/50 px-4">
    <h2 class="text-xs font-semibold">Context</h2>
    <Badge variant="secondary">{sessionStatus}</Badge>
  </header>

  <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-4">
    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current repo</h3>
      <div class="flex items-center justify-between gap-2 text-xs">
        <span class="min-w-0">
          <span class="block truncate font-medium">{desktopState.repoName}</span>
          <span class="block truncate font-mono text-[10px] text-muted-foreground">{desktopState.repoPath ?? "None"}</span>
          {#if desktopState.worktreePath}
            <span class="mt-1 block truncate font-mono text-[10px] text-muted-foreground" title={desktopState.worktreePath}>
              {desktopState.worktreePath}
            </span>
          {/if}
        </span>
        <Badge variant="outline">{desktopState.repoPath ? "Selected" : "Empty"}</Badge>
      </div>
      {#if desktopState.repoPath}
        <Button variant="outline" size="sm" class="h-7 w-fit px-2 text-xs" onclick={() => desktopState.revealFolder()}>
          Reveal folder
        </Button>
      {/if}
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session</h3>
      </div>

      <div class="grid gap-2 text-xs">
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Session ID</span>
          <span class="truncate text-right font-mono text-[11px] font-medium" title={sessionId}>{shortId(sessionId)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Model</span>
          <span class="truncate text-right font-medium">{getModelLabel(currentModel)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Messages</span>
          <span class="font-medium">{formatCount(desktopState.sessionReadModel.messages.length)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">User / assistant</span>
          <span class="font-medium">{formatCount(userMessages)} / {formatCount(assistantMessages)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Tools</span>
          <span class="font-medium">{formatCount(toolActivities)} activities</span>
        </div>
      </div>
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session context</h3>
      {#if desktopState.sessionMetadata.length > 0}
        <dl class="grid gap-1.5">
          {#each desktopState.sessionMetadata as entry (entry.label)}
            <div class="grid grid-cols-[minmax(4rem,auto)_1fr] gap-x-3 gap-y-0.5 text-xs leading-snug">
              <dt class="text-muted-foreground">{entry.label}</dt>
              <dd class="min-w-0 break-words font-medium">{entry.value}</dd>
            </div>
          {/each}
        </dl>
      {:else}
        <p class="text-[11px] text-muted-foreground">No session metadata yet.</p>
      {/if}
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent activity</h3>
      {#if desktopState.sessionReadModel.activities.length > 0}
        <ul class="flex flex-col gap-1.5">
          {#each desktopState.sessionReadModel.activities.slice(-8).reverse() as activity (activity.id)}
            <li class="flex items-start gap-2 text-xs">
              <HugeiconsIcon icon={getActivityIcon(activity.kind)} class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span class="min-w-0">
                <span class="block truncate font-medium">{activity.title ?? activity.kind}</span>
                {#if activity.content}
                  <span class="block truncate text-muted-foreground">{activity.content}</span>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-[11px] text-muted-foreground">No activity yet.</p>
      {/if}
    </section>
  </div>
</aside>
