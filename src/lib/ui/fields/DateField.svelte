<script lang="ts">
	// The date field of a form: `bind:value` or `value` + `onChange` — a string `ГГГГ-ММ-ДД` (as in the API) or null. Typing `дд.мм.гггг` or the calendar.
	import { InputDate } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';

	interface Props {
		value?: string | null;
		label?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		minDate?: Date;
		maxDate?: Date;
		class?: string;
		onChange?: (value: string | null) => void;
	}

	let { value = $bindable(null), label, error, hint, disabled = false, required = false, minDate, maxDate, class: className = '', onChange }: Props = $props();

	const bp = useBreakpoint();

	/** `2026-03-05` → local midnight (no time-zone shift) */
	function toDate(iso: string | null): Date | undefined {
		const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
		return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
	}
	const toIso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
</script>

<InputDate
	class={`w-full ${className}`}
	size={bp.isMobile ? 'l' : 'm'}
	{label}
	{error}
	hintPrefix={hint}
	{disabled}
	{required}
	{minDate}
	{maxDate}
	placeholder="дд.мм.гггг"
	useInPortal
	activeDate={toDate(value)}
	onChange={(start?: Date) => {
		const next = start && !Number.isNaN(start.getTime()) ? toIso(start) : null;
		value = next;
		onChange?.(next);
	}}
/>
