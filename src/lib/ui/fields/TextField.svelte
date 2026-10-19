<script lang="ts">
	// The text field of a form: on a desktop the DS `m` field (36 px) with its label ABOVE the box, hint or error UNDER it; on a phone the `l` field (48 px, touch
	// target) with the label inside. A DS field WITHOUT a `size` is `l` (48 px, label inside) — never use one in a form: it is taller than its neighbours.
	// `bind:value` or `value` + `onInput`. Enter → `onEnter`. `transform` filters every keystroke and paste (digits only…) through the DS `transformationRule`:
	// the cleaned text is written back into the <input> itself, so a rejected letter never stays on screen.
	import { Input } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import type { Snippet } from 'svelte';
	import type { FullAutoFill } from 'svelte/elements';
	import { useFreshError } from './fresh-error.svelte';

	interface Props {
		value?: string;
		label?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		readonly?: boolean;
		autofocus?: boolean;
		clearable?: boolean;
		required?: boolean;
		maxlength?: number;
		inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url';
		type?: string;
		autocomplete?: FullAutoFill | null;
		name?: string;
		/** the accessible name of a field that has no visible label (a link to copy) */
		ariaLabel?: string;
		/** `l` for a public page (a sign-in, a check): the box is 48 px on a desktop too */
		size?: 'm' | 'l';
		/** an icon at the end of the box (the eye of a password) and what a click on it does */
		iconSuffix?: Snippet;
		onClickIconSuffix?: () => void;
		class?: string;
		/** cleans the typed / pasted text before it reaches the field (e.g. keep digits only) */
		transform?: (raw: string) => string;
		onInput?: (value: string) => void;
		onEnter?: () => void;
		onBlur?: () => void;
	}

	let {
		value = $bindable(''),
		label,
		placeholder,
		error,
		hint,
		disabled = false,
		readonly = false,
		autofocus = false,
		clearable = false,
		required = false,
		maxlength,
		inputmode,
		type,
		autocomplete,
		name,
		ariaLabel,
		size,
		iconSuffix,
		onClickIconSuffix,
		class: className = '',
		transform,
		onInput,
		onEnter,
		onBlur
	}: Props = $props();

	// the message of a mistake goes away when the field is edited (see fresh-error)
	const fresh = useFreshError(() => error, () => value);

	const bp = useBreakpoint();
	const transformationRule = $derived(transform ? { transform: (raw = '') => transform(raw) } : undefined);
</script>

<Input
	class={['w-full', className]}
	size={size ?? (bp.isMobile ? 'l' : 'm')}
	aria-label={ariaLabel}
	{label}
	{placeholder}
	error={fresh.error}
	hintPrefix={hint}
	{value}
	{disabled}
	{required}
	readOnly={readonly}
	{clearable}
	{autofocus}
	{maxlength}
	{inputmode}
	{type}
	{autocomplete}
	{name}
	{iconSuffix}
	{onClickIconSuffix}
	{transformationRule}
	onChange={(e: Event) => {
		value = (e.target as HTMLInputElement).value;
		onInput?.(value);
	}}
	onBlur={() => onBlur?.()}
	onClear={() => {
		value = '';
		onInput?.('');
	}}
	onkeydown={(e: KeyboardEvent) => {
		if (e.key === 'Enter' && onEnter) {
			e.preventDefault();
			onEnter();
		}
	}}
/>
