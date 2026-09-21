<script lang="ts">
	// A keyboard shortcut as a keycap: «Ctrl K» — and on a Mac the command icon instead of the word: «⌘ K». The icon is drawn here (the DS has none,
	// and the ⌘ glyph is missing from the brand font, so a character would fall back to another typeface).
	import { onMount } from 'svelte';
	import { isMac } from '$lib/utils/platform';

	let { keys, class: className = '' }: { keys: string; class?: string } = $props();

	let mac = $state(false);
	onMount(() => (mac = isMac()));
</script>

<kbd class={['t-desc-l inline-flex items-center gap-1 rounded-sm border border-line-strong bg-surface-2 px-1.5 whitespace-nowrap text-muted', className]}>
	{#if mac}
		<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Command">
			<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
		</svg>
	{:else}
		Ctrl
	{/if}
	{keys}
</kbd>
