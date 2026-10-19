<script lang="ts">
	// The date field of a form: `bind:value` or `value` + `onChange` — a string `ГГГГ-ММ-ДД` (as in the API) or null. Typing `дд.мм.гггг` or the calendar.
	import { InputDate } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { useFieldValidity } from './field-validity';
	import { isPastDay } from './date-past';

	interface Props {
		value?: string | null;
		label?: string;
		error?: string;
		hint?: string;
		/** a soft warning (not a mistake, the form still saves) shown in the place of the hint while the date is before today, e.g. «Срок уже прошёл» */
		warnPast?: string;
		disabled?: boolean;
		required?: boolean;
		minDate?: Date;
		maxDate?: Date;
		class?: string;
		onChange?: (value: string | null) => void;
	}

	let { value = $bindable(null), label, error, hint, warnPast, disabled = false, required = false, minDate, maxDate, class: className = '', onChange }: Props = $props();

	const bp = useBreakpoint();
	const warning = $derived(warnPast && isPastDay(value) ? warnPast : undefined);

	// The DS field keeps a typed text that is not a date («31.02.2026», «01.01.26») on the screen, with its message under the field, and has no date then (value = null).
	// It reports the message (rt-ui 0.1.2+, `onInvalid`) and the form refuses to save while it is there: otherwise the text the user sees would be lost without a word.
	// Older rt-ui versions ignore the unknown prop.
	const reportInvalid = useFieldValidity();
	const invalidProps: Record<string, unknown> = { onInvalid: reportInvalid };

	/** `2026-03-05` → local midnight (no time-zone shift) */
	function toDate(iso: string | null): Date | undefined {
		const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
		return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
	}
	const toIso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
</script>

{#snippet warnHint()}<span class="text-warning">{warning}</span>{/snippet}

<InputDate
	class={`w-full ${className}`}
	size={bp.isMobile ? 'l' : 'm'}
	{label}
	{error}
	hintPrefix={warning ? warnHint : hint}
	{disabled}
	{required}
	{minDate}
	{maxDate}
	placeholder="дд.мм.гггг"
	{...invalidProps}
	useInPortal
	activeDate={toDate(value)}
	onChange={(start?: Date) => {
		const next = start && !Number.isNaN(start.getTime()) ? toIso(start) : null;
		value = next;
		onChange?.(next);
	}}
/>
