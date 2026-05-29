<script lang="ts" module>
	import { cn } from "$lib/utils";
	import type { ButtonProps } from "$lib/components/ui/button/index.js";

	export interface ConversationScrollButtonProps extends ButtonProps {
		bottomOffset?: number;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import ArrowDown from "@lucide/svelte/icons/arrow-down";
	import { getStickToBottomContext } from "./stick-to-bottom-context.svelte.js";
	import { fly } from "svelte/transition";
	import { backOut } from "svelte/easing";

	let { class: className, onclick, bottomOffset = 16, ...restProps }: ConversationScrollButtonProps = $props();

	const context = getStickToBottomContext();

	const handleScrollToBottom = (event: MouseEvent) => {
		context.scrollToBottom();
		if (onclick) {
			onclick(
				event as MouseEvent & {
					currentTarget: EventTarget & HTMLButtonElement;
				}
			);
		}
	};
</script>

{#if !context.isAtBottom}
	<div
		in:fly={{
			duration: 300,
			y: 10,
			easing: backOut,
		}}
		out:fly={{
			duration: 200,
			y: 10,
			easing: backOut,
		}}
		class="absolute left-[50%] translate-x-[-50%] motion-reduce:transition-none"
		style:bottom="{bottomOffset}px"
	>
		<Button
			class={cn(
				"rounded-full border-border/50 bg-background text-muted-foreground shadow-none hover:bg-accent hover:text-foreground",
				className
			)}
			onclick={handleScrollToBottom}
			size="icon"
			type="button"
			variant="outline"
			{...restProps}
		>
			<ArrowDown class="size-4" />
		</Button>
	</div>
{/if}
