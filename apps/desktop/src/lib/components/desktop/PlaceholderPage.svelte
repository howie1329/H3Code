<script lang="ts">
  import { Layout02Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { Badge } from "$lib/components/ui/badge/index.js";

  let { title, eyebrow = "Coming soon", description }: { title: string; eyebrow?: string; description: string } = $props();
</script>

<div class="flex min-h-full flex-col items-center justify-center px-6 py-10">
  <div class="grid w-full max-w-sm justify-items-center text-center">
    <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
      <HugeiconsIcon icon={Layout02Icon} data-icon />
    </div>
    <Badge variant="outline" class="mt-4">{eyebrow}</Badge>
    <h2 class="mt-3 text-xl font-semibold leading-tight tracking-tight">{title}</h2>
    <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
</div>
