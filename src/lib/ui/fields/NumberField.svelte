<script lang="ts">
	// The number or amount field of a form: `bind:value` or `value` + `onChange` (number | null). Keeps digits, «,» / «.» and «−» (only digits for `integer`);
	// an empty field is null. `min` / `max` become the hint «От 1 до 36» when there is no hint of its own.
	import { untrack } from 'svelte';
	import TextField from './TextField.svelte';

	interface Props {
		value?: number | null;
		label?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		integer?: boolean;
		required?: boolean;
		min?: number;
		max?: number;
		autofocus?: boolean;
		class?: string;
		onChange?: (value: number | null) => void;
		onEnter?: () => void;
	}

	let { value = $bindable(null), label, placeholder, error, hint, disabled = false, integer = false, required = false, min, max, autofocus = false, class: className = '', onChange, onEnter }: Props = $props();

	let text = $state('');
	// a change from outside (a form reset) rewrites the text; the own typing is never overwritten
	$effect(() => {
		const v = value;
		untrack(() => {
			const parsed = parse(text);
			if (v !== parsed) text = v === null || v === undefined ? '' : String(v).replace('.', ',');
		});
	});

	function parse(raw: string): number | null {
		const cleaned = raw.replace(/\s/g, '').replace(',', '.');
		if (!cleaned || cleaned === '-' || cleaned === '.') return null;
		const n = Number(cleaned);
		return Number.isFinite(n) ? n : null;
	}

	function input(raw: string) {
		const cleaned = raw.replace(integer ? /[^0-9-]/g : /[^0-9.,-]/g, '');
		text = cleaned;
		let n = parse(cleaned);
		if (n !== null && integer) n = Math.trunc(n);
		value = n;
		onChange?.(n);
	}

	const hintText = $derived(hint ?? (min !== undefined && max !== undefined ? `От ${min} до ${max}` : undefined));
</script>

<TextField class={className} value={text} {label} {placeholder} {error} hint={hintText} {disabled} {required} {autofocus} {onEnter} inputmode={integer ? 'numeric' : 'decimal'} onInput={input} />
