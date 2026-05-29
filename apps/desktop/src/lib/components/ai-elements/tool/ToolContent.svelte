<script lang="ts">
	import { CollapsibleContent } from "$lib/components/ui/collapsible/index.js";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type ToolVariant = "default" | "transcript";

	interface ToolContentProps {
		class?: string;
		variant?: ToolVariant;
		children?: Snippet;
		[key: string]: any;
	}

	let { class: className = "", variant = "default", children, ...restProps }: ToolContentProps = $props();

	let id = $props.id();
</script>

<CollapsibleContent
	{id}
	class={cn(
		variant === "transcript"
			? "pb-1 pl-4 outline-none"
			: "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</CollapsibleContent>
