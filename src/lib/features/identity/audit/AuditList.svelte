<script lang="ts">
	// Журнал аудита: фильтры в URL, курсорная подгрузка, строка открывает подробности. `trailing` — кнопки страницы: они стоят в строке фильтров.
	import { onMount, type Snippet } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { people } from '$lib/api/people.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import DataTable, { type Col } from '$lib/ui/DataTable.svelte';
	import TableCell from '$lib/ui/TableCell.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { auditActionLabel, auditActionTitle, auditResultMeta, entityTypeLabel } from '../labels';
	import { AUDIT_RESULT_HINTS } from '../hints';
	import { entityLabel, ensureAuditEntities } from '../audit';
	import type { AuditEntry } from '../types';
	import AuditDetails from './AuditDetails.svelte';
	import AuditFilters from './AuditFilters.svelte';
	import { AUDIT_FILTER_KEYS, apiQuery, type AuditFilters as Filters } from './audit-query';
	import { bannerText, mergeHead, occurredAt, parsePending, pendingState, pollDelay } from './pending';
	import { auditPending } from './pendingStore.svelte';

	let { trailing }: { trailing?: Snippet } = $props();

	const values = $derived(Object.fromEntries(AUDIT_FILTER_KEYS.map((k) => [k, readQuery(k)])) as unknown as Filters);
	const key = $derived(JSON.stringify(values));
	let current = $state<AuditEntry | null>(null);

	// ожидающие запечатывания события (режим очереди): поля читаются из сырого ответа, в режиме sync их нет и экран как раньше
	let pending = $state<ReturnType<typeof parsePending>>(null);
	/** с какого момента ожидание идёт непрерывно (после 10 минут опрос замедляется) */
	let waitingSince: number | null = null;

	function takePending(page: unknown) {
		const next = parsePending(page);
		waitingSince = next && next.count > 0 ? (waitingSince ?? Date.now()) : null;
		pending = next;
		auditPending.value = next;
	}

	const pager = createPager<AuditEntry>((cursor, signal) =>
		unwrap(api.GET('/api/admin/audit', { params: { query: { ...apiQuery(values), limit: 50, cursor } }, signal })).then((page) => {
			if (!cursor) takePending(page);
			people.ensure(page.items.map((i) => i.actor_id));
			ensureAuditEntities(page.items);
			return page;
		})
	);

	let timer: ReturnType<typeof setTimeout> | undefined;
	let polling = false;

	/** Первая страница с теми же фильтрами: новые строки встают сверху, фильтры, прокрутка и подгруженные страницы не трогаются. */
	async function refreshHead() {
		if (polling || pager.loading) return;
		polling = true;
		try {
			const page = await unwrap(api.GET('/api/admin/audit', { params: { query: { ...apiQuery(values), limit: 50 } } }));
			takePending(page);
			people.ensure(page.items.map((i) => i.actor_id));
			ensureAuditEntities(page.items);
			const merged = mergeHead(pager.items, page.items);
			if (merged.gap) await pager.reload();
			else pager.items = merged.items;
		} catch {
			// следующий опрос повторит
		} finally {
			polling = false;
		}
	}

	function schedule() {
		clearTimeout(timer);
		const delay = pollDelay(pending, typeof document !== 'undefined' && document.visibilityState === 'hidden', waitingSince ? Date.now() - waitingSince : 0);
		if (delay !== null) timer = setTimeout(() => void refreshHead(), delay);
	}

	$effect(() => {
		void pending;
		schedule();
		return () => clearTimeout(timer);
	});
	onMount(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible' && pendingState(pending) !== 'off') void refreshHead();
			schedule();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			auditPending.value = null;
		};
	});

	const banner = $derived(bannerText(pending));
	const pstate = $derived(pendingState(pending));
	const emptyText = $derived(pending && pending.count > 0 ? 'Подходящие события ещё запечатываются' : 'Событий по этим условиям нет');

	$effect(() => {
		void key;
		void pager.reload();
	});

	const columns: Col<AuditEntry>[] = [
		{ key: 'time', title: 'Время', render: time },
		{ key: 'actor', title: 'Сотрудник', width: 'minmax(150px, 1.2fr)', drop: 2, render: actor },
		{ key: 'action', title: 'Действие', width: 'minmax(170px, 2fr)', render: action },
		{ key: 'entity', title: 'Сущность', width: 'minmax(150px, 1.2fr)', drop: 1, render: entity },
		{ key: 'result', title: 'Результат', render: result }
	];
</script>

{#snippet time(e: AuditEntry)}<TableCell><DateText value={occurredAt(e).event} time /></TableCell>{/snippet}
{#snippet actor(e: AuditEntry)}<TableCell><span class="truncate">{e.actor_id ? people.name(e.actor_id) : 'Система'}</span></TableCell>{/snippet}
{#snippet action(e: AuditEntry)}<TableCell><span class="block truncate py-1.5" title={auditActionTitle(e.action)}>{auditActionLabel(e.action)}</span></TableCell>{/snippet}
{#snippet entity(e: AuditEntry)}
	<TableCell>
		{@const label = entityLabel(e.entity_type, e.entity_id, e)}
		<span class="flex min-w-0 gap-1">
			<span class="shrink-0">{entityTypeLabel(e.entity_type)}</span>
			{#if label}
				<span class="truncate text-muted" title={e.entity_id}>{label}</span>
			{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet result(e: AuditEntry)}
	<TableCell>
		{@const meta = auditResultMeta(e.result)}
		<StatusChip label={meta.label} tone={meta.tone} hint={AUDIT_RESULT_HINTS[e.result as keyof typeof AUDIT_RESULT_HINTS]} />
	</TableCell>
{/snippet}
{#snippet card(e: AuditEntry)}
	{@const meta = auditResultMeta(e.result)}
	<div class="flex flex-col gap-1 p-1">
		<div class="flex items-start gap-2">
			<span class="t-body-m-strong min-w-0 flex-1 break-words" title={auditActionTitle(e.action)}>{auditActionLabel(e.action)}</span>
			<StatusChip label={meta.label} tone={meta.tone} hint={AUDIT_RESULT_HINTS[e.result as keyof typeof AUDIT_RESULT_HINTS]} />
		</div>
		<span class="t-desc-l text-muted">{e.actor_id ? people.name(e.actor_id) : 'Система'} · <DateText value={occurredAt(e).event} time /></span>
	</div>
{/snippet}

<AuditFilters {values} {trailing} onChange={(patch) => void setQuery(patch)} />
{#if banner}
	<Notice tone={banner.tone} title={banner.title} role="status" aria-live="polite" data-testid="audit-pending" data-state={pstate} actions={pstate === 'delayed' ? [{ label: 'Обновить', onclick: () => void refreshHead() }] : undefined}>{banner.text}</Notice>
{:else if pstate === 'sealed'}
	<p class="t-desc-l m-0 text-muted" role="status" aria-live="polite" data-testid="audit-pending" data-state="sealed">Все события запечатаны</p>
{/if}
<DataTable
	id="audit"
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
	{emptyText}
	ariaLabel="Журнал аудита"
/>
<AuditDetails entry={current} onClose={() => (current = null)} />
