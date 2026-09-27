<script lang="ts">
	// Список воронок: фильтры в URL (тип сделки, состояние, поиск); клик по строке открывает редактор.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { AddLarge, ChevronRight } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { Btn, DateText, EmptyState, Page, PageHeader, DataTable, StatusChip, type Col, TableCell } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import type { Workflow } from '../types';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import CreateWorkflowDrawer from './CreateWorkflowDrawer.svelte';
	import { DEAL_TYPES, WORKFLOW_STATES, WORKFLOW_STATE_LABELS } from './graph';
	import { dealTypeShort, stateLabel, stateTone } from './meta';
	import { dealTypeHint, workflowStateHint } from '../hints';

	const q = $derived(readQuery('q'));
	const type = $derived(readQuery('type') || null);
	const wfState = $derived(readQuery('state') || null);

	const pager = createPager<Workflow>((cursor, signal) =>
		unwrap(api.GET('/api/workflows', { params: { query: { q: q || undefined, deal_type: type, state: wfState, limit: 50, cursor } }, signal }))
	);
	$effect(() => {
		void [q, type, wfState];
		untrack(() => void pager.reload());
	});

	const canWrite = $derived(session.can('workflow:write'));
	const activeCount = $derived([type, wfState].filter(Boolean).length);
	let creating = $state(false);

	const columns: Col<Workflow>[] = [
		{ key: 'name', title: 'Воронка', width: 'minmax(200px, 2fr)', render: nameCell },
		{ key: 'type', title: 'Тип', render: typeCell },
		{ key: 'state', title: 'Состояние', render: stateCell },
		{ key: 'published', title: 'Опубликована', drop: 1, render: publishedCell },
		{ key: 'go', title: '', render: goCell }
	];
</script>

{#snippet nameCell(w: Workflow)}
	<TableCell>
		<span class="flex min-w-0 flex-col">
			<span class="t-body-m-strong wrap-anywhere">{w.name}</span>
			<span class="t-desc-m font-mono text-soft">{w.code}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet typeCell(w: Workflow)}<TableCell><StatusChip label={dealTypeShort(w.deal_type)} tone="info" hint={dealTypeHint(w.deal_type)} /></TableCell>{/snippet}
{#snippet stateCell(w: Workflow)}
	<TableCell>
		<span class="flex flex-wrap items-center gap-1.5">
			<StatusChip label={stateLabel(w.state)} tone={stateTone(w.state)} hint={workflowStateHint(w.state)} />
			{#if w.is_default}<StatusChip label="По умолчанию" tone="accent" />{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet publishedCell(w: Workflow)}<TableCell>{#if w.published_at}<DateText value={w.published_at} />{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}
{#snippet goCell()}<TableCell><ChevronRight class="size-5 fill-soft" /></TableCell>{/snippet}

{#snippet card(w: Workflow)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class="t-body-m-strong wrap-anywhere">{w.name}</span>
		<div class="flex flex-wrap items-center gap-1.5">
			<StatusChip label={dealTypeShort(w.deal_type)} tone="info" hint={dealTypeHint(w.deal_type)} />
			<StatusChip label={stateLabel(w.state)} tone={stateTone(w.state)} hint={workflowStateHint(w.state)} />
			{#if w.is_default}<StatusChip label="По умолчанию" tone="accent" />{/if}
		</div>
		<span class="t-desc-l text-muted"><span class="font-mono">{w.code}</span>{w.published_at ? ' · ' : ''}{#if w.published_at}<DateText value={w.published_at} />{/if}</span>
	</div>
{/snippet}

<Page>
	<PageHeader title="Воронки" />

	<FilterBar primary={canWrite ? { label: 'Создать воронку', onclick: () => (creating = true) } : undefined} search={q} placeholder="Название или код" onSearch={(v) => setQuery({ q: v })} active={activeCount} onReset={() => setQuery({ type: null, state: null })}>
		{#snippet filters()}
			<Pick class="md:w-44" size="m" clearable placeholder="Любой тип" items={DEAL_TYPES.map((t) => ({ key: t, value: dealTypeShort(t) }))} value={type} onChange={(v) => setQuery({ type: v })} />
			<Pick class="md:w-48" size="m" clearable placeholder="Любое состояние" items={WORKFLOW_STATES.map((s) => ({ key: s, value: WORKFLOW_STATE_LABELS[s] }))} value={wfState} onChange={(v) => setQuery({ state: v })} />
		{/snippet}
	</FilterBar>

	<DataTable
		rows={pager.items}
		{columns}
		{card}
		loading={pager.loading}
		error={pager.error}
		onRetry={() => pager.reload()}
		hasMore={pager.hasMore}
		loadingMore={pager.loadingMore}
		onLoadMore={() => pager.loadMore()}
		onRowClick={(w) => goto(`/workflows/${w.id}`)}
		rowHref={(w) => `/workflows/${w.id}`}
		ariaLabel="Воронки"
	>
		{#snippet empty()}
			{#if q || activeCount > 0}
				<EmptyState title="Ничего не найдено" compact />
			{:else}
				<EmptyState title="Воронок пока нет">
					{#snippet action()}{#if canWrite}<Btn label="Создать воронку" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={() => (creating = true)} />{/if}{/snippet}
				</EmptyState>
			{/if}
		{/snippet}
	</DataTable>
</Page>

<CreateWorkflowDrawer open={creating} takenCodes={pager.items.map((w) => w.code)} onClose={() => (creating = false)} />
