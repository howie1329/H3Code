<script lang="ts">
  import { FolderCodeIcon, GitBranchIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState } from "$lib/desktop-state.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
</script>

<header class="flex h-11 items-center justify-between gap-3 border-b border-border/50 px-4">
  <div class="flex min-w-0 items-center gap-2">
    <h1 class="truncate text-sm font-semibold">H3Code</h1>
    <Badge variant="outline" class="hidden sm:inline-flex">PI {desktopState.piStatus.state}</Badge>
  </div>
  <div class="flex min-w-0 items-center gap-3 text-xs">
    <div class="hidden min-w-0 items-center gap-2 sm:flex" title={desktopState.repoPath ?? "No repo selected"}>
      <HugeiconsIcon icon={FolderCodeIcon} data-icon />
      <span class="min-w-0">
        <span class="block truncate font-medium leading-tight text-foreground">{desktopState.repoName}</span>
        <span class="block truncate font-mono text-[10px] leading-tight text-muted-foreground">{desktopState.repoPath ?? "No repo selected"}</span>
      </span>
    </div>
    <Button variant="ghost" size="sm" class="hidden shrink-0 sm:inline-flex" disabled>
      <HugeiconsIcon icon={GitBranchIcon} data-icon="inline-start" />
      local
    </Button>
  </div>
</header>
