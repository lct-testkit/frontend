<script lang="ts">
	// Пользовательские поля: вкладки по сущности (сделка, организация, контакт, продукт), «Активно» в строке, правка в панели.
	import { untrack } from 'svelte';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { api, unwrap, ifMatch } from '$lib/api';
	import { StatusChip, TableCell, type Col } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES, labelOf } from '../labels';
	import type { CustomFieldDef, Workflow } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import SwitchCell from '../shared/SwitchCell.svelte';
	import CatalogList from './CatalogList.svelte';
	import CatalogPage from './CatalogPage.svelte';
	import CustomFieldDrawer from './CustomFieldDrawer.svelte';

	const entity = $derived(CUSTOM_FIELD_ENTITIES.some((e) => e.key === readQuery('entity')) ? readQuery('entity') : 'deal');

	const list = createResource((signal) => unwrap(api.GET('/api/custom-field-defs', { params: { query: { entity_type: entity } }, signal })).then((r) => r.items));
	const workflows = createResource((signal) => unwrap(api.GET('/api/workflows', { params: { query: { limit: 100 } }, signal })).then((r) => r.items as Workflow[]));

	$effect(() => {
		void entity;
		untrack(() => void list.reload());
	});
	$effect(() => {
		if (entity === 'deal' && workflows.data === null && !workflows.error) untrack(() => void workflows.reload());
	});

	const canWrite = $derived(session.can('catalog:write'));
	const rows = $derived([...(list.data ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'ru')));
	const nextOrder = $derived(rows.reduce((m, r) => Math.max(m, r.sort_order), 0) + 10);
	const wfName = (id: string | null | undefined) => workflows.data?.find((w) => w.id === id)?.name ?? '';

	let drawerOpen = $state(false);
	let editing = $state<CustomFieldDef | null>(null);
	function open(item: CustomFieldDef | null) {
		editing = item;
		drawerOpen = true;
	}

	async function toggleActive(f: CustomFieldDef, next: boolean) {
		const saved = await unwrap(api.PATCH('/api/custom-field-defs/{field_id}', { params: { path: { field_id: f.id } }, body: { is_active: next }, headers: ifMatch(f.version) }));
		list.set((list.data ?? []).map((r) => (r.id === f.id ? saved : r)));
	}

	const columns: Col<CustomFieldDef>[] = [
		{ key: 'label', title: 'Поле', width: 'minmax(200px, 2fr)', render: labelCell },
		{ key: 'type', title: 'Тип', render: typeCell },
		{ key: 'required', title: 'Обязательное', drop: 2, render: requiredCell },
		{ key: 'workflow', title: 'Воронка', width: 'minmax(140px, 1fr)', drop: 1, render: wfCell },
		{ key: 'active', title: 'Активно', render: activeCell }
	];
</script>

{#snippet labelCell(f: CustomFieldDef)}
	<TableCell>
		<span class="flex min-w-0 flex-col">
			<span class="t-body-m-strong wrap-anywhere">{f.label}</span>
			<span class="t-desc-m font-mono text-soft">{f.code}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet typeCell(f: CustomFieldDef)}<TableCell><span class="t-body-s">{labelOf(CUSTOM_FIELD_TYPES, f.field_type)}</span></TableCell>{/snippet}
{#snippet requiredCell(f: CustomFieldDef)}<TableCell>{#if f.is_required}<StatusChip label="Обязательное" tone="warning" />{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}
{#snippet wfCell(f: CustomFieldDef)}<TableCell><span class="t-body-s text-muted">{wfName(f.workflow_id) || (f.workflow_id ? '…' : 'Все воронки')}</span></TableCell>{/snippet}
{#snippet activeCell(f: CustomFieldDef)}<TableCell><SwitchCell checked={f.is_active} label={f.is_active ? 'Отключить поле' : 'Включить поле'} disabled={!canWrite} onToggle={(next) => toggleActive(f, next)} /></TableCell>{/snippet}

{#snippet card(f: CustomFieldDef)}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-start justify-between gap-3">
			<span class="t-body-m-strong min-w-0 wrap-anywhere">{f.label}</span>
			<SwitchCell checked={f.is_active} label={f.is_active ? 'Отключить поле' : 'Включить поле'} disabled={!canWrite} onToggle={(next) => toggleActive(f, next)} />
		</div>
		<div class="t-desc-l flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
			<span class="font-mono">{f.code}</span>
			<span>{labelOf(CUSTOM_FIELD_TYPES, f.field_type)}</span>
			{#if f.is_required}<StatusChip label="Обязательное" tone="warning" />{/if}
		</div>
	</div>
{/snippet}

<CatalogPage active="custom-fields" createLabel="Новое поле" onCreate={() => open(null)}>
	{#snippet toolbar()}
		<SegmentedControl class="max-w-full self-start" size="m" value={entity} onChange={(v: string) => setQuery({ entity: v === 'deal' ? null : v })}>
			{#each CUSTOM_FIELD_ENTITIES as e (e.key)}<Segment index={e.key} label={e.value} />{/each}
		</SegmentedControl>
	{/snippet}

	<CatalogList
		{rows}
		{columns}
		{card}
		loading={list.loading}
		error={list.error}
		onRetry={() => list.reload()}
		emptyText="Полей пока нет"
		createLabel="Новое поле"
		onCreate={() => open(null)}
		onEdit={(f) => open(f)}
		ariaLabel="Пользовательские поля"
	/>
</CatalogPage>

<CustomFieldDrawer
	open={drawerOpen}
	item={editing}
	presetEntity={entity}
	{nextOrder}
	workflows={workflows.data ?? []}
	onClose={() => (drawerOpen = false)}
	onSaved={() => void list.reload()}
/>
