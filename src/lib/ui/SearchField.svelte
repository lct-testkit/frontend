<script lang="ts">
	// Search box: debounced `onSearch(value)` (default 300 ms), clearable, Enter fires immediately, Esc clears.
	import { Input } from '@lct-testkit/rt-ui';
	import { Search } from '@lct-testkit/rt-ui/icons';
	import { debounce } from '$lib/utils/debounce';

	interface Props {
		value?: string;
		placeholder?: string;
		onSearch: (value: string) => void;
		delay?: number;
		size?: 's' | 'm' | 'l';
		autofocus?: boolean;
		class?: string;
	}

	let { value = '', placeholder = 'Поиск', onSearch, delay = 300, size = 'm', autofocus = false, class: className = '' }: Props = $props();

	// what is typed; it follows `value` when the page changes it from outside (the writable $derived resets on every change of `value`)
	let text = $derived(value);

	// svelte-ignore state_referenced_locally
	const fire = debounce((v: string) => onSearch(v), delay);
	function change(next: string) {
		text = next;
		fire(next);
	}
</script>

{#snippet lead()}<Search />{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class={['w-full min-w-0', className]}
	role="search"
	onkeydown={(e) => (e.key === 'Enter' ? fire.flush() : e.key === 'Escape' && text ? (change(''), fire.flush()) : null)}
>
	<Input
		{size}
		{placeholder}
		value={text}
		clearable
		iconPrefix={lead}
		onChange={(e: Event) => change((e.target as HTMLInputElement).value)}
		onClear={() => (change(''), fire.flush())}
		aria-label={placeholder}
		{autofocus}
	/>
</div>
