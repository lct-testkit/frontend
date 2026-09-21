<script lang="ts">
	// The multi-line field of a form (DS `m` on a desktop, `l` on a phone — see TextField): grows with its text up to `maxRows`. `bind:value` or `value` + `onInput`.
	// Ctrl/⌘+Enter → `onSubmit`. `ref` is the <textarea> itself (to insert text at the cursor).
	import { TextArea } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';

	interface Props {
		value?: string;
		label?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		autofocus?: boolean;
		required?: boolean;
		rows?: number;
		maxRows?: number;
		maxlength?: number;
		ref?: HTMLTextAreaElement | null;
		class?: string;
		onInput?: (value: string) => void;
		onSubmit?: () => void;
	}

	let {
		value = $bindable(''),
		label,
		placeholder,
		error,
		hint,
		disabled = false,
		autofocus = false,
		required = false,
		rows = 3,
		maxRows = 8,
		maxlength,
		ref = $bindable(null),
		class: className = '',
		onInput,
		onSubmit
	}: Props = $props();

	const bp = useBreakpoint();
</script>

<TextArea
	class={['w-full', className]}
	size={bp.isMobile ? 'l' : 'm'}
	{label}
	{placeholder}
	{error}
	hintPrefix={hint}
	{value}
	{disabled}
	{required}
	{autofocus}
	{rows}
	{maxlength}
	bind:ref
	autoHeight={{ enabled: true, maxRows }}
	onChange={(e: Event) => {
		value = (e.target as HTMLTextAreaElement).value;
		onInput?.(value);
	}}
	onkeydown={(e: KeyboardEvent) => {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && onSubmit) {
			e.preventDefault();
			onSubmit();
		}
	}}
/>
