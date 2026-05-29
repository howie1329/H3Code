<script lang="ts">
	import { cn } from "$lib/utils";

	interface Props {
		class?: string;
		children?: import("svelte").Snippet;
	}

	let { class: className, children, ...props }: Props = $props();
	// indexing
</script>

<div class={cn("flex h-10 items-center justify-between border-t border-border/50 px-3", className)} {...props}>
	{#if children}
		{@render children()}
	{/if}
</div>
