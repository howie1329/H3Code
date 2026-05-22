<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";

  let { title, eyebrow = "Coming soon", description }: { title: string; eyebrow?: string; description: string } = $props();
</script>

<div class="min-h-0 flex-1 overflow-auto p-6">
  <section class="max-w-3xl border border-border/50 bg-background p-6">
    <Badge variant="outline">{eyebrow}</Badge>
    <h2 class="mt-4 text-2xl font-semibold tracking-tight">{title}</h2>
    <p class="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
  </section>
</div>
