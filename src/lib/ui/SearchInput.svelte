<script lang="ts">
	// Search field of the top bar: the DS Input with the loupe in front and, optionally, a key hint («Ctrl K») at the end.
	// The hint is a keycap that sits inside the field's own suffix slot, so it keeps the field's inset and never touches the border.
	import { Input } from '@lct-testkit/rt-ui';
	import { Search } from '@lct-testkit/rt-ui/icons';
	import Keycap from './Keycap.svelte';

	interface Props {
		value?: string;
		placeholder?: string;
		/** the letter of the shortcut that focuses the field (`K` → «Ctrl K», on a Mac «⌘ K»); leave empty on touch screens */
		shortcut?: string;
		size?: 's' | 'm' | 'l';
		/** the <input> element */
		ref?: HTMLInputElement | null;
		[key: string]: unknown;
	}

	let { value = '', placeholder = 'Поиск', shortcut, size = 'm', ref = $bindable(null), ...rest }: Props = $props();
</script>

{#snippet lead()}<Search />{/snippet}
{#snippet keycap()}<Keycap keys={shortcut!} class="mr-3" />{/snippet}

<Input bind:ref {size} {placeholder} {value} iconPrefix={lead} iconSuffix={shortcut ? keycap : undefined} {...rest} />
