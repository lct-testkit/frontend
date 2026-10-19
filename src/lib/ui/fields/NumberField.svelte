<script lang="ts">
	// The number or amount field of a form: `bind:value` or `value` + `onChange` (number | null). Letters never get in: every keystroke and paste is cleaned to
	// digits, one «,» / «.» (none for `integer`) and a leading minus (only when `min` is below 0 or `allowNegative` is set — amounts and counts never take one); an empty field is null. What is shown is what is sent: `maxInt` / `decimals` stop the typing at the digits the server accepts (an amount: `maxInt={12} decimals={2}`). `min` / `max` become the hint «От 1 до 36» when there is no hint of its own.
	import { untrack } from 'svelte';
	import TextField from './TextField.svelte';
	import { sanitizeNumber } from './number-input';

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
		/** a negative number is allowed (default: only when `min` is below 0) — a custom numeric field, a condition value */
		allowNegative?: boolean;
		/** the most digits before the separator (default 15; an integer field of a count: 9) */
		maxInt?: number;
		/** the most digits after the separator (an amount: 2) */
		decimals?: number;
		max?: number;
		autofocus?: boolean;
		class?: string;
		onChange?: (value: number | null) => void;
		onEnter?: () => void;
	}

	let { value = $bindable(null), label, placeholder, error, hint, disabled = false, integer = false, required = false, min, allowNegative, maxInt, decimals, max, autofocus = false, class: className = '', onChange, onEnter }: Props = $props();

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

	const sanitize = (raw: string) => sanitizeNumber(raw, { integer, negative: allowNegative ?? (min !== undefined && min < 0), maxInt: maxInt ?? (integer ? 9 : 15), maxFrac: decimals });

	function input(raw: string) {
		const cleaned = sanitize(raw);
		text = cleaned;
		let n = parse(cleaned);
		if (n !== null && integer) n = Math.trunc(n);
		value = n;
		onChange?.(n);
	}

	const hintText = $derived(hint ?? (min !== undefined && max !== undefined ? `От ${min} до ${max}` : undefined));
</script>

<TextField class={className} value={text} {label} {placeholder} {error} hint={hintText} {disabled} {required} {autofocus} {onEnter} inputmode={integer ? 'numeric' : 'decimal'} transform={sanitize} onInput={input} />
