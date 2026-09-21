<script lang="ts">
	// Фильтры журнала: действие, тип сущности, результат и период — в строке; сотрудник, id сущности и id запроса — в панели «Фильтры».
	// Кнопки страницы (проверка цепочки, выгрузка) стоят в конце этой же строки (`trailing`), а не отдельной строкой над ней.
	import type { Snippet } from 'svelte';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import UserPicker from '$lib/ui/UserPicker.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import RangeField from '$lib/ui/fields/RangeField.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { AUDIT_ACTION_LABEL, ENTITY_TYPE_LABEL, auditResultMeta } from '../labels';
	import { activeCount, emptyFilters, type AuditFilters } from './audit-query';

	let { values, onChange, trailing }: { values: AuditFilters; onChange: (patch: Partial<AuditFilters>) => void; trailing?: Snippet } = $props();

	// текст набирают долго: адрес и запрос обновляем, когда человек остановился
	const typed = debounce((patch: Partial<AuditFilters>) => onChange(patch), 400);
	const count = $derived(activeCount(values));
	const moreCount = $derived([values.actor_id, values.entity_id, values.request_id].filter(Boolean).length);

	const actions = Object.entries(AUDIT_ACTION_LABEL)
		.map(([key, value]) => ({ key, value, hint: key }))
		.sort((a, b) => a.value.localeCompare(b.value, 'ru'));
	const entities = Object.entries(ENTITY_TYPE_LABEL)
		.map(([key, value]) => ({ key, value }))
		.sort((a, b) => a.value.localeCompare(b.value, 'ru'));
	const results = ['success', 'denied', 'error'].map((key) => ({ key, value: auditResultMeta(key).label }));
</script>

{#snippet filters()}
	<Pick label="Действие" items={actions} value={values.action || null} clearable search placeholder="Любое" onChange={(v) => onChange({ action: v ?? '' })} />
	<Pick label="Сущность" items={entities} value={values.entity_type || null} clearable search placeholder="Любая" onChange={(v) => onChange({ entity_type: v ?? '' })} />
	<Pick label="Результат" items={results} value={values.result || null} clearable placeholder="Любой" onChange={(v) => onChange({ result: v ?? '' })} />
	<RangeField label="Период" from={values.from} to={values.to} onChange={(from, to) => onChange({ from, to })} />
{/snippet}

{#snippet more()}
	<UserPicker label="Сотрудник" value={values.actor_id || null} onChange={(id) => onChange({ actor_id: id ?? '' })} />
	<TextField label="ID сущности" value={values.entity_id} onInput={(v) => typed({ entity_id: v.trim() })} />
	<TextField label="ID запроса" value={values.request_id} onInput={(v) => typed({ request_id: v.trim() })} />
{/snippet}

<FilterBar active={count} onReset={() => onChange(emptyFilters())} {filters} {more} moreActive={moreCount} {trailing} />
