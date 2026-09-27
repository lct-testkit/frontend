<script lang="ts">
	// Входящие сообщения: чей вызов, подпись верна или нет, что обработано и к какой сущности привело.
	import { untrack } from 'svelte';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { DateText, FilterBar, IconBtn, Notice, StatusChip, TableCell, type Col } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { INBOUND_STATUSES, INTEGRATION_SOURCES, labelOf } from '../labels';
	import type { InboundMessage } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import CatalogList from '../catalog/CatalogList.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { LIMITS } from './limits';
	import { inboundHint } from '../hints';

	const source = $derived(readQuery('source') || null);
	const limit = $derived(Number(readQuery('limit')) || 100);
	const list = createResource((signal) => unwrap(api.GET('/api/admin/integrations/inbound-messages', { params: { query: { source_code: source, limit } }, signal })).then((r) => r as InboundMessage[]));
	$effect(() => {
		void [source, limit];
		untrack(() => void list.reload());
	});

	const tone = (s: string) => (s === 'processed' ? 'success' : s === 'failed' ? 'error' : s === 'duplicate' ? 'warning' : 'neutral');
	/** ссылка на сущность-результат, если у неё есть свой экран */
	const href = (m: InboundMessage): string | null => (m.resulting_entity_id ? (m.resulting_entity_type === 'deal' ? `/deals/${m.resulting_entity_id}` : m.resulting_entity_type === 'contact' ? `/contacts/${m.resulting_entity_id}` : null) : null);

	const columns: Col<InboundMessage>[] = [
		{ key: 'when', title: 'Получено', render: whenCell },
		{ key: 'source', title: 'Источник', width: 'minmax(140px, 1fr)', render: sourceCell },
		{ key: 'sig', title: 'Подпись', render: sigCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'result', title: 'Результат', width: 'minmax(160px, 1fr)', drop: 1, render: resultCell }
	];
</script>

{#snippet whenCell(m: InboundMessage)}<TableCell><span class="t-body-s"><DateText value={m.received_at} time /></span></TableCell>{/snippet}
{#snippet sourceCell(m: InboundMessage)}
	<TableCell>
		<span class="flex min-w-0 flex-col"><span class="t-body-m-strong">{labelOf(INTEGRATION_SOURCES, m.source_code)}</span><span class="t-desc-m text-soft wrap-anywhere">{m.message_type ?? '—'} · {m.external_id}</span></span>
	</TableCell>
{/snippet}
{#snippet sigCell(m: InboundMessage)}<TableCell><StatusChip label={m.signature_valid ? 'Верна' : 'Неверна'} tone={m.signature_valid ? 'success' : 'error'} /></TableCell>{/snippet}
{#snippet statusCell(m: InboundMessage)}<TableCell><StatusChip label={labelOf(INBOUND_STATUSES, m.status)} tone={tone(m.status)} hint={inboundHint(m.status, m.error)} /></TableCell>{/snippet}
{#snippet resultCell(m: InboundMessage)}
	<TableCell>
		{#if href(m)}<a class="t-body-s" href={href(m)}>Открыть {m.resulting_entity_type === 'deal' ? 'сделку' : 'контакт'}</a>
		{:else if m.error}<span class="t-desc-l line-clamp-2 text-danger" title={m.error}>{m.error}</span>
		{:else}<span class="text-soft">—</span>{/if}
	</TableCell>
{/snippet}

{#snippet card(m: InboundMessage)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2"><span class="t-body-m-strong">{labelOf(INTEGRATION_SOURCES, m.source_code)}</span><StatusChip label={labelOf(INBOUND_STATUSES, m.status)} tone={tone(m.status)} hint={inboundHint(m.status, m.error)} /></div>
		<span class="t-desc-l text-muted"><DateText value={m.received_at} time /> · {m.message_type ?? m.external_id}</span>
		<span class="flex flex-wrap items-center gap-2">
			<StatusChip label={m.signature_valid ? 'Подпись верна' : 'Подпись неверна'} tone={m.signature_valid ? 'success' : 'error'} />
			{#if href(m)}<a class="t-desc-l" href={href(m)}>Открыть</a>{/if}
		</span>
		{#if m.error}<span class="t-desc-l line-clamp-3 text-danger wrap-anywhere">{m.error}</span>{/if}
	</div>
{/snippet}

{#snippet filters()}
	<Pick label="Источник" clearable placeholder="Любой" value={source} items={INTEGRATION_SOURCES.map((s) => ({ key: s.key, value: s.value }))} onChange={(v) => setQuery({ source: v })} />
	<Pick label="Показывать" value={String(limit)} items={LIMITS.map((n) => ({ key: String(n), value: `Последние ${n}` }))} onChange={(v) => setQuery({ limit: v === '100' ? null : v })} />
{/snippet}
{#snippet trailing()}<IconBtn icon={Refresh} label="Обновить" onclick={() => list.reload()} />{/snippet}

<Notice class="shrink-0" tone="info">Журнал сообщений, которые внешние системы присылают в CRM. Здесь их можно только смотреть.</Notice>
<FilterBar active={source ? 1 : 0} onReset={() => setQuery({ source: null })} {filters} {trailing} />
<CatalogList rows={list.data ?? []} {columns} {card} loading={list.loading} error={list.error} onRetry={() => list.reload()} filtered={Boolean(source)} emptyText="Входящих сообщений нет" ariaLabel="Входящие сообщения" />
