<script lang="ts">
	// Иерархия направлений: свёртываемое дерево, у узла — «подраздел» и правка; клик по названию открывает панель.
	import { SvelteSet } from 'svelte/reactivity';
	import { AddSmall, ChevronDown, ChevronRight, Edit } from '@lct-testkit/rt-ui/icons';
	import { Btn, EmptyState, ErrorState, IconBtn, Skeleton } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { count } from '$lib/utils/format';
	import type { Direction } from '../types';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import CatalogPage from './CatalogPage.svelte';
	import DirectionDrawer from './DirectionDrawer.svelte';
	import { buildForest, type DirNode } from './directions';
	import { directions, ensureDirections } from './directions.svelte';

	ensureDirections();

	const q = $derived(readQuery('q').trim().toLowerCase());
	const all = $derived(directions.data ?? []);
	const canWrite = $derived(session.can('catalog:write'));
	const collapsed = new SvelteSet<string>();

	/** Узлы, подходящие под поиск, вместе с предками (иначе совпадение нельзя найти в дереве). */
	const visible = $derived.by(() => {
		if (!q) return null;
		const byId = new Map(all.map((d) => [d.id, d]));
		const keep = new Set<string>();
		for (const d of all) {
			if (`${d.name} ${d.code}`.toLowerCase().includes(q)) {
				for (let cur: Direction | undefined = d; cur && !keep.has(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) keep.add(cur.id);
			}
		}
		return keep;
	});
	const forest = $derived(buildForest(all));

	let drawerOpen = $state(false);
	let editing = $state<Direction | null>(null);
	let presetParent = $state<string | null>(null);

	function open(item: Direction | null, parent: string | null = null) {
		editing = item;
		presetParent = parent;
		drawerOpen = true;
	}
	const raw = (id: string) => all.find((d) => d.id === id) ?? null;
	const toggle = (id: string) => (collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id));
	const shown = (n: DirNode) => !visible || visible.has(n.id);
</script>

{#snippet branch(nodes: DirNode[], depth: number)}
	<ul class="m-0 flex list-none flex-col gap-0.5 p-0">
		{#each nodes.filter(shown) as node (node.id)}
			{@const open_ = !collapsed.has(node.id) || Boolean(visible)}
			<li>
				<div class="flex min-h-11 items-center gap-1 rounded-md pr-1 hover:bg-surface-2 md:min-h-10" style:padding-left="{depth * 20 + 4}px">
					{#if node.children.length}
						<IconBtn icon={open_ ? ChevronDown : ChevronRight} label={open_ ? 'Свернуть' : 'Развернуть'} size="s" onclick={() => toggle(node.id)} />
					{:else}
						<span class="size-8 flex-none"></span>
					{/if}
					<!-- название-кнопка на всю строку дерева: аналога в rt-ui нет -->
					<button
						type="button"
						class="m-0 flex min-w-0 flex-1 cursor-pointer appearance-none items-center self-stretch border-0 bg-transparent p-0 py-1 text-left font-[inherit] text-[inherit] disabled:cursor-default"
						disabled={!canWrite}
						onclick={() => open(raw(node.id))}
					>
						<span class="flex min-w-0 flex-1 items-baseline gap-3">
							<span class="t-body-m-strong truncate">{node.name}</span>
							<span class="t-desc-m flex-none font-mono text-soft max-md:hidden">{node.code}</span>
							{#if node.children.length}<span class="t-desc-m flex-none text-soft">{node.children.length}</span>{/if}
						</span>
					</button>
					{#if canWrite}
						<IconBtn icon={AddSmall} label="Добавить подраздел" size="s" onclick={() => open(null, node.id)} />
						<IconBtn icon={Edit} label="Изменить" size="s" onclick={() => open(raw(node.id))} />
					{/if}
				</div>
				{#if node.children.length && open_}{@render branch(node.children, depth + 1)}{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<CatalogPage active="directions" createLabel="Новое направление" onCreate={() => open(null)}>
	{#snippet toolbar()}
		<FilterBar search={readQuery('q')} placeholder="Название или код" onSearch={(v) => setQuery({ q: v })} />
	{/snippet}

	<section class="rounded-lg border border-line bg-surface p-2 max-md:p-1" aria-label="Направления">
		{#if directions.error}
			<ErrorState error={directions.error} onRetry={() => directions.reload()} />
		{:else if directions.loading}
			<div class="p-3"><Skeleton kind="rows" rows={6} /></div>
		{:else if all.length === 0}
			<EmptyState title="Направлений пока нет">
				{#snippet action()}{#if canWrite}<Btn label="Новое направление" variant="outline" colorScheme="neutral" onclick={() => open(null)} />{/if}{/snippet}
			</EmptyState>
		{:else if visible && visible.size === 0}
			<EmptyState title="Ничего не найдено" compact />
		{:else}
			{@render branch(forest, 0)}
			<p class="t-desc-m px-3 pt-2 pb-1 text-soft">{count(all.length, ['направление', 'направления', 'направлений'])}</p>
		{/if}
	</section>
</CatalogPage>

<DirectionDrawer
	open={drawerOpen}
	item={editing}
	{presetParent}
	{all}
	onClose={() => (drawerOpen = false)}
	onSaved={() => void directions.reload()}
	onAddChild={(parentId) => {
		editing = null;
		presetParent = parentId;
	}}
/>
