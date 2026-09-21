<script lang="ts">
	// Причины отказа: группы по категории, внутри — порядок стрелками «выше / ниже», переключатель «Активна» в строке.
	import { onMount } from 'svelte';
	import { AddSmall, ArrowDown, ArrowUp, Edit } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap, ifMatch } from '$lib/api';
	import { Btn, EmptyState, ErrorState, IconBtn, Skeleton, toast } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { LOSS_REASON_CATEGORIES } from '../labels';
	import type { LossReason } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import SwitchCell from '../shared/SwitchCell.svelte';
	import CatalogPage from './CatalogPage.svelte';
	import LossReasonDrawer from './LossReasonDrawer.svelte';

	const list = createResource((signal) => unwrap(api.GET('/api/loss-reasons', { signal })).then((r) => r.items));
	onMount(() => void list.reload());

	const canWrite = $derived(session.can('catalog:write'));
	const items = $derived(list.data ?? []);
	const nextOrder = $derived(items.reduce((m, r) => Math.max(m, r.sort_order), 0) + 10);

	const groups = $derived(
		LOSS_REASON_CATEGORIES.map((c) => ({
			key: c.key,
			title: c.value,
			rows: items.filter((r) => r.category === c.key).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ru'))
		})).filter((g) => g.rows.length > 0)
	);

	let drawerOpen = $state(false);
	let editing = $state<LossReason | null>(null);
	let preset = $state<string | null>(null);
	let busy = $state(false);

	function open(item: LossReason | null, category: string | null = null) {
		editing = item;
		preset = category;
		drawerOpen = true;
	}

	function replace(saved: LossReason) {
		list.set(items.map((r) => (r.id === saved.id ? saved : r)));
	}

	async function toggleActive(r: LossReason, next: boolean) {
		replace(await unwrap(api.PATCH('/api/loss-reasons/{loss_reason_id}', { params: { path: { loss_reason_id: r.id } }, body: { is_active: next }, headers: ifMatch(r.version) })));
	}

	/** Меняет местами соседей в группе. У всех причин по умолчанию `sort_order = 0`, поэтому порядок группы перенумеровывается 10, 20, 30… */
	async function move(rows: LossReason[], index: number, dir: -1 | 1) {
		const target = index + dir;
		if (busy || target < 0 || target >= rows.length) return;
		const order = [...rows];
		[order[index], order[target]] = [order[target], order[index]];
		const changes = order.map((r, i) => ({ r, sort: (i + 1) * 10 })).filter(({ r, sort }) => r.sort_order !== sort);
		busy = true;
		try {
			const saved = await Promise.all(
				changes.map(({ r, sort }) =>
					unwrap(api.PATCH('/api/loss-reasons/{loss_reason_id}', { params: { path: { loss_reason_id: r.id } }, body: { sort_order: sort }, headers: ifMatch(r.version) }))
				)
			);
			const byId = new Map(saved.map((s) => [s.id, s]));
			list.set(items.map((r) => byId.get(r.id) ?? r));
		} catch (e) {
			toast.error(e);
			void list.reload();
		} finally {
			busy = false;
		}
	}
</script>

<CatalogPage active="loss-reasons" createLabel="Новая причина" onCreate={() => open(null)}>
	{#if list.error}
		<ErrorState error={list.error} onRetry={() => list.reload()} />
	{:else if list.loading}
		<Skeleton kind="rows" rows={6} />
	{:else if items.length === 0}
		<EmptyState title="Причин отказа пока нет">
			{#snippet action()}{#if canWrite}<Btn label="Новая причина" onclick={() => open(null)} />{/if}{/snippet}
		</EmptyState>
	{:else}
		<div class="flex flex-col gap-4">
			{#each groups as group (group.key)}
				<section class="overflow-hidden rounded-lg border border-line bg-surface" aria-label={group.title}>
					<header class="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2 max-md:px-3">
						<h2 class="t-body-m-strong min-w-0 flex-1 truncate">{group.title}</h2>
						<span class="t-desc-m text-soft">{group.rows.length}</span>
						{#if canWrite}<IconBtn icon={AddSmall} label="Добавить в «{group.title}»" size="s" onclick={() => open(null, group.key)} />{/if}
					</header>
					<ul class="m-0 flex list-none flex-col p-0">
						{#each group.rows as row, i (row.id)}
							<li class="flex min-h-14 items-center gap-2 border-b border-line px-4 py-1.5 last:border-b-0 max-md:gap-1 max-md:px-2">
								{#if canWrite}
									<span class="flex flex-none flex-col">
										<IconBtn icon={ArrowUp} label="Выше" size="s" disabled={busy || i === 0} onclick={() => move(group.rows, i, -1)} />
										<IconBtn icon={ArrowDown} label="Ниже" size="s" disabled={busy || i === group.rows.length - 1} onclick={() => move(group.rows, i, 1)} />
									</span>
								{/if}
								<div class={['flex min-w-0 flex-1 flex-col', !row.is_active && 'opacity-60']}>
									<span class="t-body-m-strong wrap-anywhere">{row.name}</span>
									<span class="t-desc-m font-mono text-soft">{row.code}</span>
								</div>
								<SwitchCell checked={row.is_active} label={row.is_active ? 'Отключить причину' : 'Включить причину'} disabled={!canWrite} onToggle={(next) => toggleActive(row, next)} />
								{#if canWrite}<IconBtn icon={Edit} label="Изменить" onclick={() => open(row)} />{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</CatalogPage>

<LossReasonDrawer open={drawerOpen} item={editing} {nextOrder} presetCategory={preset} onClose={() => (drawerOpen = false)} onSaved={() => void list.reload()} />
