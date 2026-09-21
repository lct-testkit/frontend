<script lang="ts">
	// Иконка rt-ui с цветом из токенов темы (у SVG цвет задаётся заливкой, поэтому оборачиваем).
	import type { Component } from 'svelte';

	interface Props {
		icon: Component<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
		tone?: 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'muted' | 'soft' | 'fg';
		/** px */
		size?: number;
		class?: string;
	}

	let { icon, tone = 'muted', size = 20, class: className = '' }: Props = $props();

	const TONE = {
		success: '[&_svg]:fill-success',
		danger: '[&_svg]:fill-danger',
		warning: '[&_svg]:fill-warning',
		info: '[&_svg]:fill-info',
		accent: '[&_svg]:fill-accent',
		muted: '[&_svg]:fill-muted',
		soft: '[&_svg]:fill-soft',
		fg: '[&_svg]:fill-fg'
	} as const;

	const Icon = $derived(icon);
</script>

<span class={['inline-flex flex-none items-center justify-center [&_svg]:size-full', TONE[tone], className]} style:width="{size}px" style:height="{size}px" aria-hidden="true"><Icon /></span>
