<script lang="ts">
  import { onMount } from "svelte";
  import {
    AddCircleIcon,
    AiBrain02Icon,
    AlertCircleIcon,
    ArrowUp02Icon,
    Clock04Icon,
    FolderCodeIcon,
    GitBranchIcon,
    Layout02Icon,
    SearchList01Icon,
    Settings05Icon,
    StopCircleIcon,
    TerminalIcon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import {
    PromptInput,
    PromptInputBody,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
    type PromptInputMessage,
  } from "$lib/components/ai-elements/prompt-input/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  type ActivityItem = {
    type: string;
    detail: string;
  };

  const platform = typeof window === "undefined" ? "desktop" : (window.h3code?.platform ?? "desktop");

  let promptValue = $state("");
  let repoPath = $state<string | undefined>();
  let sessions = $state<PiSessionSummary[]>([]);
  let selectedSessionPath = $state<string | undefined>();
  let sessionState = $state<PiSessionState | undefined>();
  let messages = $state<unknown[]>([]);
  let piStatus = $state<PiStatus>({ state: "disconnected" });
  let activity = $state<ActivityItem[]>([]);
  let isBusy = $state(false);
  let errorMessage = $state<string | undefined>();

  let selectedSession = $derived(sessions.find((session) => session.path === selectedSessionPath));
  let canUseSession = $derived(piStatus.state === "connected" && Boolean(selectedSessionPath || sessionState?.sessionFile));
  let canSubmit = $derived(canUseSession && !isBusy && promptValue.trim().length > 0);
  let repoName = $derived(repoPath ? basename(repoPath) : "No repo selected");
  let modelLabel = $derived(formatModel(sessionState));

  onMount(() => {
    const removeEventListener = window.h3code?.onPiEvent((event) => {
      const item = formatActivity(event);
      activity = [item, ...activity].slice(0, 8);

      if (item.type === "agent_end") {
        void refreshActiveMessages();
      }
    });

    const removeStatusListener = window.h3code?.onPiStatus((status) => {
      piStatus = status;

      if (status.diagnostic) {
        errorMessage = status.diagnostic;
      }
    });

    return () => {
      removeEventListener?.();
      removeStatusListener?.();
    };
  });

  async function handleSelectRepo() {
    const selected = await window.h3code?.selectRepo();

    if (!selected) {
      return;
    }

    await connectRepo(selected.path);
  }

  async function connectRepo(nextRepoPath: string) {
    await withBusy(async () => {
      errorMessage = undefined;
      activity = [];
      const result = await requireApi().connectRepo(nextRepoPath);

      repoPath = result.repoPath;
      sessions = result.sessions;
      selectedSessionPath = result.selectedSessionPath;
      sessionState = result.state;
      messages = result.messages ?? [];
    });
  }

  async function handleSwitchSession(sessionPath: string) {
    if (sessionPath === selectedSessionPath) {
      return;
    }

    await withBusy(async () => {
      errorMessage = undefined;
      const result = await requireApi().switchSession(sessionPath);
      selectedSessionPath = sessionPath;
      sessionState = result.state;
      messages = result.messages;
    });
  }

  async function handleNewSession() {
    await withBusy(async () => {
      errorMessage = undefined;
      const result = await requireApi().newSession(selectedSessionPath);
      sessionState = result.state;
      selectedSessionPath = result.state.sessionFile;
      messages = result.messages;
      sessions = await requireApi().listSessions();
    });
  }

  async function handlePromptSubmit(message: PromptInputMessage, event: SubmitEvent) {
    event.preventDefault();

    const text = message.text?.trim();

    if (!text || !canUseSession) {
      return;
    }

    await withBusy(async () => {
      errorMessage = undefined;
      await requireApi().sendPrompt(text, sessionState?.isStreaming ? "followUp" : undefined);
      promptValue = "";
      await refreshActiveMessages();
    });
  }

  async function handleAbort() {
    await withBusy(async () => {
      errorMessage = undefined;
      await requireApi().abort();
      await refreshActiveMessages();
    });
  }

  async function refreshActiveMessages() {
    if (!selectedSessionPath) {
      return;
    }

    try {
      const result = await requireApi().switchSession(selectedSessionPath);
      sessionState = result.state;
      messages = result.messages;
    } catch (error) {
      errorMessage = getErrorMessage(error);
    }
  }

  async function withBusy(action: () => Promise<void>) {
    isBusy = true;

    try {
      await action();
    } catch (error) {
      errorMessage = getErrorMessage(error);
    } finally {
      isBusy = false;
    }
  }

  function requireApi() {
    if (!window.h3code) {
      throw new Error("Desktop API is unavailable.");
    }

    return window.h3code;
  }

  function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  function basename(value: string) {
    const clean = value.replace(/\/+$/, "");
    return clean.slice(clean.lastIndexOf("/") + 1) || clean;
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function formatModel(state: PiSessionState | undefined) {
    const model = state?.model;

    if (!model) {
      return "Model unknown";
    }

    return [model.provider, model.id ?? model.modelId].filter(Boolean).join("/");
  }

  function formatMessageRole(message: unknown) {
    const record = toRecord(message);
    const role = record.role ?? record.type;
    return typeof role === "string" ? role : "message";
  }

  function formatMessageText(message: unknown): string {
    const record = toRecord(message);
    const content = record.content ?? record.text ?? record.message;

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          const partRecord = toRecord(part);
          return typeof partRecord.text === "string" ? partRecord.text : "";
        })
        .filter(Boolean)
        .join("\n");
    }

    return JSON.stringify(message, null, 2);
  }

  function formatActivity(event: unknown): ActivityItem {
    const record = toRecord(event);
    const type = typeof record.type === "string" ? record.type : "event";
    const toolName = typeof record.toolName === "string" ? record.toolName : undefined;
    const message = typeof record.message === "string" ? record.message : undefined;

    return {
      type,
      detail: toolName ?? message ?? type,
    };
  }

  function toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  }

  const navItems = [
    { label: "Workspace", icon: Layout02Icon, active: true },
    { label: "Sessions", icon: AiBrain02Icon },
    { label: "Repos", icon: FolderCodeIcon },
    { label: "Activity", icon: Clock04Icon },
  ];
</script>

<svelte:head>
  <title>H3Code Desktop</title>
  <meta name="description" content="H3Code desktop scaffold." />
</svelte:head>

<Sidebar.Provider class="h-screen min-h-0 overflow-hidden bg-background text-foreground">
  <Sidebar.Sidebar collapsible="icon">
    <Sidebar.Header class="gap-2 px-2 py-2">
      <div class="flex h-8 items-center justify-between gap-1">
        <a
          href="/"
          class="flex min-w-0 items-center gap-2 rounded-full px-1.5 py-1 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="H3Code workspace"
        >
          <span class="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            H3
          </span>
          <span class="truncate text-xs font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            H3Code
          </span>
        </a>
        <div class="flex shrink-0 items-center gap-1 group-data-[collapsible=icon]:hidden">
          <Sidebar.Trigger aria-label="Collapse sidebar" />
          <Button variant="ghost" size="icon-sm" aria-label="New session" disabled={piStatus.state !== "connected"} onclick={handleNewSession}>
            <HugeiconsIcon icon={AddCircleIcon} data-icon />
          </Button>
        </div>
      </div>

      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="sm" tooltipContent="Search workspace">
            <HugeiconsIcon icon={SearchList01Icon} />
            <span>Search workspace</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Header>

    <Sidebar.Separator />

    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupContent>
          <Sidebar.Menu aria-label="Primary">
            {#each navItems as item}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  size="sm"
                  isActive={item.active}
                  tooltipContent={item.label}
                  aria-current={item.active ? "page" : undefined}
                  class={item.active ? "rounded-full" : "rounded-full text-muted-foreground"}
                >
                  <HugeiconsIcon icon={item.icon} />
                  <span>{item.label}</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>

      <Sidebar.Separator />

      <Sidebar.Group>
        <div class="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <Sidebar.GroupLabel class="h-7 px-2 text-[11px] font-medium uppercase tracking-wide">
            Runtime
          </Sidebar.GroupLabel>
          <Badge variant={piStatus.state === "connected" ? "secondary" : "outline"}>{piStatus.state}</Badge>
        </div>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton size="sm" tooltipContent="PI Agent">
                <HugeiconsIcon icon={TerminalIcon} />
                <span>PI Agent</span>
                <span class="ml-auto truncate text-[11px] text-muted-foreground">{platform}</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>

      <Sidebar.Separator />

      <Sidebar.Group class="min-h-0 flex-1">
        <Sidebar.GroupLabel class="h-7 px-2 text-[11px] font-medium uppercase tracking-wide">
          Sessions
        </Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#if sessions.length === 0}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton size="lg" tooltipContent="No sessions" class="h-9 text-muted-foreground">
                  <HugeiconsIcon icon={AiBrain02Icon} />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-medium">No sessions</span>
                    <span class="block truncate text-[10px] text-muted-foreground">Select a repo or create one</span>
                  </span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {:else}
              {#each sessions as session}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton
                    size="lg"
                    isActive={session.path === selectedSessionPath}
                    tooltipContent={session.name ?? session.firstMessage ?? session.id}
                    aria-pressed={session.path === selectedSessionPath}
                    class="h-11"
                    onclick={() => handleSwitchSession(session.path)}
                  >
                    <HugeiconsIcon icon={AiBrain02Icon} />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-medium">{session.name ?? (session.firstMessage || "Untitled session")}</span>
                      <span class="block truncate font-mono text-[10px] text-muted-foreground">
                        {session.messageCount} messages · {formatDate(session.modified)}
                      </span>
                    </span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              {/each}
            {/if}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>

    <Sidebar.Footer class="border-t border-sidebar-border px-2 py-2">
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="sm" tooltipContent="Settings" class="text-muted-foreground">
            <HugeiconsIcon icon={Settings05Icon} />
            <span>Settings</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
      <div class="flex items-center justify-between px-2 font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
        <span>{platform}</span>
        <span>local</span>
      </div>
    </Sidebar.Footer>

    <Sidebar.Rail />
  </Sidebar.Sidebar>

  <Sidebar.Inset class="min-w-0 overflow-hidden">
    <header class="flex h-11 items-center justify-between gap-3 border-b border-border px-4">
      <div class="flex min-w-0 items-center gap-2">
        <h1 class="truncate text-sm font-semibold">H3Code</h1>
        <Badge variant="outline" class="hidden sm:inline-flex">PI {piStatus.state}</Badge>
      </div>
      <div class="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="sm" class="min-w-0 max-w-64 justify-start px-2 text-left" onclick={handleSelectRepo} disabled={isBusy}>
          <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
          <span class="min-w-0">
            <span class="block truncate text-xs font-medium leading-tight text-foreground">{repoName}</span>
            <span class="block truncate font-mono text-[10px] leading-tight text-muted-foreground">{repoPath ?? "Select a local folder"}</span>
          </span>
        </Button>
        <Button variant="ghost" size="sm" class="hidden shrink-0 sm:inline-flex" disabled>
          <HugeiconsIcon icon={GitBranchIcon} data-icon="inline-start" />
          local
        </Button>
        <Button variant="ghost" size="sm" class="hidden max-w-48 shrink-0 sm:inline-flex">
          <span class="truncate">{modelLabel}</span>
        </Button>
        <Button size="sm" class="shrink-0" onclick={handleSelectRepo} disabled={isBusy}>
          <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
          Select repo
        </Button>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_24rem]">
      <section class="flex min-w-0 flex-col">
        <div class="flex h-10 items-center border-b border-border/50 px-4">
          <div class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={TerminalIcon} data-icon />
            <span class="truncate font-medium text-foreground">Transcript</span>
            <span class="truncate">{selectedSession?.name ?? selectedSession?.firstMessage ?? "No PI session selected"}</span>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 overflow-auto px-6 py-5">
            {#if errorMessage}
              <div class="mb-4 flex items-start gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                <HugeiconsIcon icon={AlertCircleIcon} data-icon />
                <span>{errorMessage}</span>
              </div>
            {/if}

            {#if !repoPath}
              <div class="flex min-h-full items-center justify-center py-8">
                <div class="flex w-full max-w-2xl flex-col items-center text-center">
                  <div class="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={FolderCodeIcon} data-icon />
                  </div>
                  <p class="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ready for first connection
                  </p>
                  <h2 class="mt-2 text-xl font-semibold tracking-tight">Select a repo to load PI sessions.</h2>
                  <p class="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    H3Code starts PI RPC in the selected folder and renders PI-owned session messages here.
                  </p>
                  <Button class="mt-5" onclick={handleSelectRepo} disabled={isBusy}>
                    <HugeiconsIcon icon={FolderCodeIcon} data-icon="inline-start" />
                    Select repo
                  </Button>
                </div>
              </div>
            {:else if sessions.length === 0}
              <div class="flex min-h-full items-center justify-center py-8">
                <div class="flex w-full max-w-2xl flex-col items-center text-center">
                  <div class="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={AiBrain02Icon} data-icon />
                  </div>
                  <p class="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    No PI sessions
                  </p>
                  <h2 class="mt-2 text-xl font-semibold tracking-tight">Create a new PI-owned session.</h2>
                  <p class="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    This repo has no PI sessions yet. H3Code will not create one until you ask it to.
                  </p>
                  <Button class="mt-5" onclick={handleNewSession} disabled={piStatus.state !== "connected" || isBusy}>
                    <HugeiconsIcon icon={AddCircleIcon} data-icon="inline-start" />
                    New session
                  </Button>
                </div>
              </div>
            {:else if messages.length === 0}
              <div class="flex min-h-full items-center justify-center py-8">
                <div class="flex w-full max-w-2xl flex-col items-center text-center">
                  <div class="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={TerminalIcon} data-icon />
                  </div>
                  <p class="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Empty transcript
                  </p>
                  <h2 class="mt-2 text-xl font-semibold tracking-tight">Send a prompt to PI.</h2>
                </div>
              </div>
            {:else}
              <div class="mx-auto flex max-w-3xl flex-col gap-4">
                {#each messages as message}
                  <article class="grid gap-1 border-b border-border/50 pb-4 last:border-b-0">
                    <div class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{formatMessageRole(message)}</div>
                    <pre class="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">{formatMessageText(message)}</pre>
                  </article>
                {/each}
              </div>
            {/if}
          </div>

          <div class="border-t border-border/50 px-4 py-3">
            <PromptInput
              onSubmit={handlePromptSubmit}
              class="flex min-h-24 flex-col rounded-md border border-border/50 bg-background shadow-none focus-within:ring-2 focus-within:ring-ring/30"
            >
              <PromptInputBody>
                <label for="prompt" class="sr-only">Prompt</label>
                <PromptInputTextarea
                  id="prompt"
                  bind:value={promptValue}
                  class="min-h-16 px-3 py-2 text-xs leading-5 placeholder:text-muted-foreground"
                  placeholder={canUseSession ? "Ask PI to inspect this repo, implement a change, or explain the current state..." : "Select a repo and PI session first..."}
                  disabled={!canUseSession || isBusy}
                />
              </PromptInputBody>
              <PromptInputToolbar class="flex h-9 items-center justify-between border-t border-border/50 px-2">
                <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline">{sessionState?.isStreaming ? "Follow-up" : "Prompt"}</Badge>
                  <span>Enter to send · Shift+Enter newline</span>
                </div>
                <div class="flex items-center gap-1">
                  <Button variant="ghost" size="sm" class="text-muted-foreground" onclick={handleAbort} disabled={!sessionState?.isStreaming || isBusy}>
                    <HugeiconsIcon icon={StopCircleIcon} data-icon="inline-start" />
                    Abort
                  </Button>
                  <PromptInputSubmit class="h-6 gap-1 px-2 text-xs" disabled={!canSubmit}>
                    <HugeiconsIcon icon={ArrowUp02Icon} data-icon="inline-start" />
                    Send
                  </PromptInputSubmit>
                </div>
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      </section>

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
                <span class="block truncate font-medium">{repoName}</span>
                <span class="block truncate font-mono text-[10px] text-muted-foreground">{repoPath ?? "None"}</span>
              </span>
              <Badge variant="outline">{repoPath ? "Selected" : "Empty"}</Badge>
            </div>
          </section>

          <Separator />

          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session</h3>
            <div class="grid gap-2 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">State</span>
                <span class="font-medium">{sessionState?.isStreaming ? "Running" : "Idle"}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">Messages</span>
                <span class="font-medium">{sessionState?.messageCount ?? messages.length}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">Thinking</span>
                <span class="font-medium">{sessionState?.thinkingLevel ?? "Unknown"}</span>
              </div>
            </div>
          </section>

          <Separator />

          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Runtime diagnostics</h3>
            <div class="grid gap-2 text-xs">
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">PI RPC</span>
                <span class="truncate text-right font-medium">{piStatus.state}</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Executable</span>
                <span class="truncate text-right font-medium">pi</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Working dir</span>
                <span class="truncate text-right font-medium">{repoPath ?? "None"}</span>
              </div>
              {#if piStatus.diagnostic}
                <div class="text-muted-foreground">{piStatus.diagnostic}</div>
              {/if}
            </div>
          </section>

          <Separator />

          <section class="flex flex-col gap-2">
            <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tool activity</h3>
            <div class="flex flex-col gap-1">
              {#if activity.length === 0}
                <div class="px-2 py-1 text-xs text-muted-foreground">No activity yet</div>
              {:else}
                {#each activity as event}
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
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
