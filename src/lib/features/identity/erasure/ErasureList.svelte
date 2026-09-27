<script lang="ts" module>
	import type { components } from '$lib/api';

	// список отдаёт те же записи, что и карточка (ErasureRequestListResponse.items = ErasureRequestDetail[])
	type Row = components['schemas']['ErasureRequestDetail'];

	// «Отсрочка» = pending + approved: два статуса бэкенда, для человека это одно состояние
	export const STATUS_TABS = [
		{ key: 'all', label: 'Все' },
		{ key: 'blocked', label: 'Заблокированы' },
		{ key: 'grace', label: 'Отсрочка' },
		{ key: 'completed', label: 'Исполнены' },
		{ key: 'rejected', label: 'Отклонены' }
	] as const;
	/** the tab that is on: the value of `?status=` (unknown or missing = «Все») */
	export function statusTab(raw: string): string {
		return STATUS_TABS.find((t) => t.key === raw)?.key ?? 'all';
	}
</script>

<script lang="ts">
	// Запросы на удаление/обезличивание ПДн: статус и тип субъекта в адресной строке, курсорная подгрузка, строка ведёт в карточку запроса.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { DateText, FilterBar, DataTable, StatusChip, type Col, TableCell } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { graceCountdown } from '../erasure';
	import { ERASURE_MODE_LABEL, ERASURE_SUBJECT_LABEL, blockerHint, erasureStatusMeta } from '../labels';
	import { ERASURE_STATUS_HINTS } from '../hints';
	import { ensureSubjects, subjectName } from './subject';

	const SUBJECTS = (Object.keys(ERASURE_SUBJECT_LABEL) as (keyof typeof ERASURE_SUBJECT_LABEL)[]).map((k) => ({ key: k, value: ERASURE_SUBJECT_LABEL[k] }));

	const tab = $derived(statusTab(readQuery('status')));
	const status = $derived(tab === 'all' ? '' : tab);
	// `?approval_id=…&subject_type=…` — не фильтр, а заполненная форма «Выполнить» из согласований (страница её откроет и очистит адрес)
	const subjectType = $derived(readQuery('approval_id') ? '' : readQuery('subject_type'));
	const serverStatus = $derived(status === 'grace' ? undefined : status || undefined);
	const key = $derived(`${serverStatus ?? ''}|${subjectType}`);

	const pager = createPager<Row>((cursor, signal) =>
		unwrap(api.GET('/api/admin/erasure-requests', { params: { query: { status: serverStatus, subject_type: subjectType || undefined, limit: 50, cursor } }, signal }))
	);
	onMount(() => () => pager.abort());
	$effect(() => {
		void key;
		void pager.reload();
	});

	const rows = $derived(status === 'grace' ? pager.items.filter((r) => r.status === 'pending' || r.status === 'approved') : pager.items);
	$effect(() => ensureSubjects(pager.items));
	// отсрочка фильтруется на клиенте: пока подходящих строк мало, а страницы есть — дозагружаем
	$effect(() => {
		if (status === 'grace' && rows.length < 10 && pager.hasMore && !pager.loading && !pager.loadingMore) void pager.loadMore();
	});

	export function reload() {
		void pager.reload();
	}

	/** что сейчас держит запрос: блокеры, отсрочка или ничего */
	function term(r: Row): string {
		if (r.status === 'blocked') return r.blockers?.length ? r.blockers.map((b) => blockerHint(b.code, b.detail).label).join(', ') : 'Есть блокеры';
		if (r.status === 'pending' || r.status === 'approved') return graceCountdown(r.grace_until).label;
		return '—';
	}

	const columns: Col<Row>[] = [
		{ key: 'subject', title: 'Субъект', width: 'minmax(220px, 2fr)', render: subject },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'term', title: 'Что дальше', width: 'minmax(200px, 2fr)', drop: 2, render: termCell },
		{ key: 'deadline', title: 'Ответить до', drop: 1, render: deadline }
	];
</script>

{#snippet subject(r: Row)}
	<TableCell>
		<span class="flex min-w-0 flex-col py-2">
			<span class="t-body-s-strong truncate">{subjectName(r.subject_type, r.subject_id)}</span>
			<span class="t-desc-m truncate text-muted">{ERASURE_SUBJECT_LABEL[r.subject_type as keyof typeof ERASURE_SUBJECT_LABEL] ?? r.subject_type} · {ERASURE_MODE_LABEL[r.mode as keyof typeof ERASURE_MODE_LABEL] ?? r.mode}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet statusCell(r: Row)}
	<TableCell>
		{@const meta = erasureStatusMeta(r.status)}
		<span class="block py-2"><StatusChip label={meta.label} tone={meta.tone} hint={ERASURE_STATUS_HINTS[r.status as keyof typeof ERASURE_STATUS_HINTS]} /></span>
	</TableCell>
{/snippet}
{#snippet termCell(r: Row)}<TableCell><span class="block truncate py-2 text-muted" title={term(r)}>{term(r)}</span></TableCell>{/snippet}
{#snippet deadline(r: Row)}<TableCell><span class="block py-2"><DateText value={r.deadline_at} /></span></TableCell>{/snippet}
{#snippet card(r: Row)}
	{@const meta = erasureStatusMeta(r.status)}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-start justify-between gap-2">
			<span class="t-body-s-strong min-w-0 wrap-anywhere">{subjectName(r.subject_type, r.subject_id)}</span>
			<StatusChip label={meta.label} tone={meta.tone} hint={ERASURE_STATUS_HINTS[r.status as keyof typeof ERASURE_STATUS_HINTS]} />
		</div>
		<span class="t-desc-l text-muted">{ERASURE_SUBJECT_LABEL[r.subject_type as keyof typeof ERASURE_SUBJECT_LABEL] ?? r.subject_type} · {ERASURE_MODE_LABEL[r.mode as keyof typeof ERASURE_MODE_LABEL] ?? r.mode}</span>
		{#if term(r) !== '—'}<span class="t-desc-l">{term(r)}</span>{/if}
	</div>
{/snippet}

{#snippet filters()}
	<Pick label="Субъект" items={SUBJECTS} value={subjectType || null} clearable placeholder="Любой" onChange={(v) => void setQuery({ subject_type: v })} />
{/snippet}

<FilterBar active={subjectType ? 1 : 0} onReset={() => void setQuery({ subject_type: '' })} {filters} />
<DataTable
	id="admin-erasure"
	{rows}
	{columns}
	{card}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	onRowClick={(r) => goto(`/admin/erasure/${r.id}`)}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	emptyText={status || subjectType ? 'Запросов с такими условиями нет' : 'Запросов на удаление ПДн пока нет'}
	ariaLabel="Запросы на удаление ПДн"
/>
