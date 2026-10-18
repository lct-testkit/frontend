<script lang="ts">
	// Период дат: `from` / `to` — строки `ГГГГ-ММ-ДД`.
	import { InputDate } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { inFilterRow } from '$lib/ui/filter-row';

	interface Props {
		from?: string;
		to?: string;
		label?: string;
		class?: string;
		onChange: (from: string, to: string) => void;
	}

	let { from = '', to = '', label, class: className = '', onChange }: Props = $props();

	const bp = useBreakpoint();
	// in the one-line filter row a field has no caption above it: the label is its placeholder
	const bare = inFilterRow();

	function toDate(iso: string): Date | undefined {
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
		return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
	}
	const toIso = (d?: Date): string =>
		d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
</script>

<InputDate
	class={`w-full ${className}`}
	size={bp.isMobile ? 'l' : 'm'}
	label={bare ? undefined : label}
	isRange
	placeholder={bare && label ? label : 'дд.мм.гггг — дд.мм.гггг'}
	aria-label={bare ? label : undefined}
	title={bare ? label : undefined}
	useInPortal
	activeDate={toDate(from)}
	secondDate={toDate(to)}
	onChange={(start?: Date, end?: Date) => onChange(toIso(start), toIso(end))}
/>
