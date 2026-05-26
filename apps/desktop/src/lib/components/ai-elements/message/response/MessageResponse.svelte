<script lang="ts">
	import { Streamdown, type StreamdownProps } from 'streamdown-svelte';
	import { code } from '@streamdown-svelte/code';
	import { mode } from 'mode-watcher';
	import githubDarkDefault from '@shikijs/themes/github-dark-default';
	import githubLightDefault from '@shikijs/themes/github-light-default';
	import { cn } from '$lib/utils';

	type Props = StreamdownProps & {
		transcript?: boolean;
	};

	let { content, class: className, components, transcript = false, ...restProps }: Props = $props();
	let currentTheme = $derived(
		mode.current === 'dark' ? 'github-dark-default' : 'github-light-default'
	);
</script>

<div
	data-transcript-markdown={transcript ? '' : undefined}
	class={cn(
		'size-full text-sm leading-snug text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
		transcript && [
			'[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold',
			'[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold',
			'[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-medium',
			'[&_p]:my-1.5',
			'[&_ul]:my-1.5 [&_ol]:my-1.5',
			'[&_li]:my-0.5',
			'[&_pre]:my-2 [&_pre]:max-h-[min(100%,var(--transcript-code-max-height,280px))] [&_pre]:overflow-y-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/50 [&_pre]:bg-muted/30 [&_pre]:py-2 [&_pre]:font-mono [&_pre]:text-xs',
			'[&_pre_code]:text-xs',
			'[&_.line-numbers]:hidden',
		],
		className
	)}
>
	<Streamdown
		{content}
		baseTheme="shadcn"
		shikiTheme={currentTheme}
		shikiThemes={{
			'github-light-default': githubLightDefault,
			'github-dark-default': githubDarkDefault
		}}
		plugins={{ code }}
		{...restProps}
	/>
</div>

