<script lang="ts">
	// A panel under a button (recent, notifications): the design system's Popover with title, body and footer.
	// Closes on outside click and the cross (Popover), on Esc and when the trigger is pressed again; the trigger keeps its own state (`open`).
	import type { Snippet } from 'svelte';
	import { Popover } from '@lct-testkit/rt-ui';

	interface Props {
		open: boolean;
		onClose: () => void;
		trigger: Snippet;
		children: Snippet;
		title: string;
		footer?: Snippet;
	}

	let { open, onClose, trigger, children, title, footer }: Props = $props();
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && onClose()} />

{#snippet body()}
	<div class="max-h-[min(60dvh,28rem)] w-[26rem] max-w-[calc(100vw-4rem)] overflow-y-auto overscroll-contain">{@render children()}</div>
{/snippet}

<Popover class="w-auto flex-none" isOpened={open} {onClose} placement="bottomRight" pointer={false} {title} body={body} footer={footer} showCloseButton={false}>
	{@render trigger()}
</Popover>
