<script lang="ts">
	// Фильтры журнала безопасности: события (несколько), серьёзность и период — в строке; сотрудник и адрес — в панели «Фильтры».
	// Кнопки страницы (выгрузка) стоят в конце этой же строки (`trailing`). Список событий — известные типы плюс те, что сервер реально присылал за последний месяц.
	import type { Snippet } from 'svelte';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import RangeField from '$lib/ui/fields/RangeField.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import UserPicker from '$lib/ui/UserPicker.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { SECURITY_EVENT_LABELS, securityEventHint, securityEventLabel } from './security-labels';
	import { activeCount, emptySecurityFilters, joinTypes, splitTypes, type SecurityFilters } from './security-query';

	let { values, extraTypes = [], onChange, trailing }: { values: SecurityFilters; extraTypes?: string[]; onChange: (patch: Partial<SecurityFilters>) => void; trailing?: Snippet } = $props();

	const typed = debounce((patch: Partial<SecurityFilters>) => onChange(patch), 400);
	const count = $derived(activeCount(values));
	const moreCount = $derived([values.user, values.ip].filter(Boolean).length);
	const types = $derived(
		[...new Set([...Object.keys(SECURITY_EVENT_LABELS), ...extraTypes, ...splitTypes(values.type)])]
			.map((key) => ({ key, value: securityEventLabel(key), hint: securityEventHint(key) }))
			.sort((a, b) => a.value.localeCompare(b.value, 'ru'))
	);
	const severities = [
		{ key: 'warning', value: 'Предупреждение и выше' },
		{ key: 'critical', value: 'Только критичные' }
	];
</script>

{#snippet filters()}
	<MultiPick label="Событие" items={types} value={splitTypes(values.type)} placeholder="Любое" autoHeight={false} onChange={(v) => onChange({ type: joinTypes(v) })} />
	<Pick label="Серьёзность" items={severities} value={values.severity || null} clearable placeholder="Любая" onChange={(v) => onChange({ severity: v ?? '' })} />
	<RangeField label="Период" from={values.from} to={values.to} onChange={(from, to) => onChange({ from, to })} />
{/snippet}

{#snippet more()}
	<UserPicker label="Сотрудник" value={values.user || null} onChange={(id) => onChange({ user: id ?? '' })} />
	<TextField label="IP-адрес или сеть" value={values.ip} placeholder="203.0.113.7 или 203.0.113.0/24" onInput={(v) => typed({ ip: v.trim() })} />
{/snippet}

<FilterBar active={count} onReset={() => onChange(emptySecurityFilters())} {filters} {more} moreActive={moreCount} {trailing} />
