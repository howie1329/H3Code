<script lang="ts">
	import { cn } from "$lib/utils";
	import { CollapsibleContent } from "$lib/components/ui/collapsible/index.js";
	import MessageResponse from "$lib/components/ai-elements/message/response/MessageResponse.svelte";

	interface Props {
		class?: string;
		content: string;
	}

	let { class: className = "", content, ...props }: Props = $props();
</script>

<CollapsibleContent
	class={cn(
		"mt-1 text-muted-foreground outline-none",
		"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none",
		className
	)}
	{...props}
>
	<MessageResponse class="grid gap-2" {content} transcript />
</CollapsibleContent>
