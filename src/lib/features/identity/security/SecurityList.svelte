<script lang="ts">
	// Журнал событий безопасности: фильтры в адресе, курсорная подгрузка, строка открывает подробности (устройство, подробности события, переход к источнику).
	import type { Snippet } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { people } from '$lib/api/people.svelte';
	import DataTable, { type Col } from '$lib/ui/DataTable.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import TableCell from '$lib/ui/TableCell.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import type { components } from '$lib/api';
	import SecurityDetails from './SecurityDetails.svelte';
	import SecurityFilters from './SecurityFilters.svelte';
	import { securityEventHint, securityEventLabel, severityMeta } from './security-labels';
	import { SECURITY_FILTER_KEYS, apiQuery, readFilters } from './security-query';

	type Event = components['schemas']['SecurityEventOut'];

	let { trailing, extraTypes = [] }: { trailing?: Snippet; extraTypes?: string[] } = $props();

	const values = $derived(readFilters(readQuery));
	const key = $derived(JSON.stringify(values));
	let current = $state<Event | null>(null);

	const pager = createPager<Event>((cursor, signal) => unwrap(api.GET('/api/admin/security-events', { params: { query: { ...apiQuery(values), limit: 50, cursor } }, signal })).then((page) => page));

	$effect(() => {
		void key;
		void pager.reload();
	});

	/** Имя из ответа сервера; если сотрудник уже обезличен или удалён, так и пишем. */
	const who = (e: Event): string => (e.user_id ? (e.user_display ?? people.name(e.user_id, 'Сотрудник удалён')) : '—');

	const columns: Col<Event>[] = [
		{ key: 'time', title: 'Время', render: time },
		{ key: 'sev', title: 'Серьёзность', render: sev },
		{ key: 'type', title: 'Событие', width: 'minmax(190px, 2fr)', render: type },
		{ key: 'user', title: 'Сотрудник', width: 'minmax(140px, 1.2fr)', drop: 2, render: user },
		{ key: 'ip', title: 'IP', drop: 1, render: ip }
	];
</script>

{#snippet time(e: Event)}<TableCell><DateText value={e.created_at} time /></TableCell>{/snippet}
{#snippet sev(e: Event)}
	{@const s = severityMeta(e.severity)}
	<TableCell><StatusChip label={s.label} tone={s.tone} /></TableCell>
{/snippet}
{#snippet type(e: Event)}<TableCell><span class="block truncate py-1.5" title={securityEventHint(e.event_type)}>{securityEventLabel(e.event_type)}</span></TableCell>{/snippet}
{#snippet user(e: Event)}<TableCell><span class="truncate">{who(e)}</span></TableCell>{/snippet}
{#snippet ip(e: Event)}<TableCell><span class="font-mono">{e.ip ?? '—'}</span></TableCell>{/snippet}
{#snippet card(e: Event)}
	{@const s = severityMeta(e.severity)}
	<div class="flex flex-col gap-1 p-1">
		<div class="flex items-start gap-2">
			<span class="t-body-m-strong min-w-0 flex-1 break-words">{securityEventLabel(e.event_type)}</span>
			<StatusChip label={s.label} tone={s.tone} />
		</div>
		<span class="t-desc-l text-muted"><DateText value={e.created_at} time />{e.user_id ? ` · ${who(e)}` : ''}{e.ip ? ` · ${e.ip}` : ''}</span>
	</div>
{/snippet}

<SecurityFilters {values} {extraTypes} {trailing} onChange={(patch) => void setQuery(patch)} />
<DataTable
	id="security"
	rows={pager.items}
	{columns}
	{card}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	onRowClick={(e) => (current = e)}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	emptyText={SECURITY_FILTER_KEYS.some((k) => values[k]) ? 'Событий по этим условиям нет' : 'Событий за выбранный период нет'}
	ariaLabel="События безопасности"
/>
<SecurityDetails entry={current} onClose={() => (current = null)} />
