<script lang="ts">
	// Таблица распределения: строка на вуз («КГТУ — 4 сделки») с выбором «Кому»; стрелка раскрывает сделки вуза, у каждой тоже можно выбрать другого.
	// Сделки без вуза — одна группа «Физические лица». Ниже — вузы самого сотрудника (кому перейдёт ответственность за вуз).
	import { ChevronDown, ChevronRight } from '@lct-testkit/rt-ui/icons';
	import { IconBtn } from '$lib/ui';
	import FilterRow from '$lib/ui/FilterRow.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { plural } from '$lib/utils/format';
	import { type AllocationChoice, type DealGroup, type OrgItem } from './allocation';

	interface Props {
		groups: DealGroup[];
		orgs: OrgItem[];
		choice: AllocationChoice;
		/** кандидаты: сотрудники, между которыми распределяем */
		candidates: { id: string; label: string }[];
		/** сделки, которые сервер не принял («уже не принадлежит увольняемому») */
		stale?: ReadonlySet<string>;
		onChange: (next: AllocationChoice) => void;
	}

	let { groups, orgs, choice, candidates, stale = new Set(), onChange }: Props = $props();

	const DEFAULT_KEY = '__default';
	let open = $state<Record<string, boolean>>({});

	const items = $derived([{ key: DEFAULT_KEY, value: 'Как у всех' }, ...candidates.map((c) => ({ key: c.id, value: c.label }))]);
	const dealsWord = (n: number) => plural(n, ['сделка', 'сделки', 'сделок']);

	const setGroup = (key: string, v: string | null) => onChange({ ...choice, groups: { ...choice.groups, [key]: v === DEFAULT_KEY ? null : v } });
	const setDeal = (id: string, v: string | null) => onChange({ ...choice, deals: { ...choice.deals, [id]: v === DEFAULT_KEY ? null : v } });
	const setOrg = (id: string, v: string | null) => onChange({ ...choice, orgs: { ...choice.orgs, [id]: v === DEFAULT_KEY ? null : v } });
</script>

<div class="flex flex-col gap-2" data-testid="allocation">
	{#each groups as g (g.key)}
		<div class="rounded-md border border-line bg-surface">
			<div class="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,13rem)] items-center gap-2 px-2 py-1.5 max-md:grid-cols-[auto_minmax(0,1fr)]">
				<IconBtn icon={open[g.key] ? ChevronDown : ChevronRight} label={open[g.key] ? 'Свернуть сделки' : 'Показать сделки'} size="s" aria-expanded={!!open[g.key]} onclick={() => (open[g.key] = !open[g.key])} />
				<span class="t-body-m min-w-0 break-words"><span class="font-medium">{g.name}</span> <span class="text-muted">— {g.deals.length} {dealsWord(g.deals.length)}</span></span>
				<div class="max-md:col-span-2"><FilterRow><Pick label="Кому" size="s" items={items} value={choice.groups[g.key] ?? DEFAULT_KEY} onChange={(v) => setGroup(g.key, v)} /></FilterRow></div>
			</div>
			{#if open[g.key]}
				<ul class="m-0 flex list-none flex-col border-t border-line p-0">
					{#each g.deals as d (d.id)}
						<li class={['grid grid-cols-[minmax(0,1fr)_minmax(0,13rem)] items-center gap-2 border-b border-line px-3 py-1.5 last:border-b-0 max-md:grid-cols-1', stale.has(d.id) && 'bg-danger-soft']} data-testid="alloc-deal" data-deal={d.id}>
							<span class="t-body-s min-w-0 break-words"><a href="/deals/{d.id}" class="whitespace-nowrap">{d.number ?? d.id.slice(-4)}</a> <span class="text-muted">{d.title ?? ''}</span>{#if d.closed}<span class="text-soft"> · закрыта</span>{/if}</span>
							<FilterRow><Pick label="Кому" size="s" items={items} value={choice.deals[d.id] ?? (choice.groups[g.key] ? choice.groups[g.key] : DEFAULT_KEY)} onChange={(v) => setDeal(d.id, v)} /></FilterRow>
							{#if stale.has(d.id)}<span class="t-desc-l text-danger col-span-full" role="alert">Сделку уже передали или удалили — обновите список.</span>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/each}

	{#if orgs.length}
		<h3 class="t-body-m-strong m-0 mt-2">Вузы сотрудника: {orgs.length}</h3>
		<p class="t-desc-l m-0 -mt-1 text-muted">Кому перейдёт ответственность за вуз (сделки вуза — выше, они распределяются отдельно).</p>
		{#each orgs as o (o.id)}
			<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,13rem)] items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 max-md:grid-cols-1" data-testid="alloc-org">
				<span class="t-body-m min-w-0 break-words font-medium">{o.title ?? 'Организация'}</span>
				<FilterRow><Pick label="Кому" size="s" items={items} value={choice.orgs[o.id] ?? DEFAULT_KEY} onChange={(v) => setOrg(o.id, v)} /></FilterRow>
			</div>
		{/each}
	{/if}
</div>
