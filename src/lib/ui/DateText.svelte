<script lang="ts">
	// `<DateText value={iso} />` → 05.03.2026;  `time` → 05.03.2026, 14:30;  `relative` → «5 минут назад» (exact time in the tooltip).
	import { formatDate, formatDateTime, formatRelative } from '$lib/utils/format';

	let { value, time = false, relative = false }: { value: string | Date | number | null | undefined; time?: boolean; relative?: boolean } = $props();
</script>

<time datetime={value ? new Date(value).toISOString() : undefined} title={relative || !time ? formatDateTime(value) : undefined}>
	{relative ? formatRelative(value) : time ? formatDateTime(value) : formatDate(value)}
</time>
