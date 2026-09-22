<script lang="ts">
	// Производственный календарь: год сегментами, даты по месяцам; праздники и переносы (рабочий выходной) — разными метками.
	import { untrack } from 'svelte';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { Edit } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { Btn, EmptyState, ErrorState, IconBtn, Skeleton, StatusChip } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import type { Holiday } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import CatalogPage from './CatalogPage.svelte';
	import HolidayDrawer from './HolidayDrawer.svelte';

	const thisYear = new Date().getFullYear();
	const year = $derived(Number(readQuery('year')) || thisYear);
	const years = $derived([...new Set([thisYear - 1, thisYear, thisYear + 1, year])].sort());

	const list = createResource(async (signal) => {
		const res = await unwrap(api.GET('/api/holidays', { params: { query: { date_from: `${year}-01-01`, date_to: `${year}-12-31` } }, signal }));
		return res.items;
	});
	$effect(() => {
		void year;
		untrack(() => void list.reload());
	});

	const canWrite = $derived(session.can('catalog:write'));
	const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
	const dayName = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
	const parse = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

	const months = $derived.by(() => {
		const rows = [...(list.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));
		const map = new Map<number, Holiday[]>();
		for (const h of rows) map.set(Number(h.date.slice(5, 7)), [...(map.get(Number(h.date.slice(5, 7))) ?? []), h]);
		return [...map].map(([m, items]) => ({ month: m, title: monthName.format(new Date(year, m - 1, 1)), items }));
	});

	let drawerOpen = $state(false);
	let editing = $state<Holiday | null>(null);
	function open(item: Holiday | null) {
		editing = item;
		drawerOpen = true;
	}
	const presetDate = $derived(`${year}-${String(year === thisYear ? new Date().getMonth() + 1 : 1).padStart(2, '0')}-01`);
</script>

<CatalogPage active="holidays" createLabel="Добавить дату" onCreate={() => open(null)}>
	{#snippet toolbar()}
		<SegmentedControl class="self-start" size="m" value={String(year)} onChange={(v: string) => setQuery({ year: Number(v) === thisYear ? null : v })}>
			{#each years as y (y)}<Segment index={String(y)} label={String(y)} />{/each}
		</SegmentedControl>
	{/snippet}

	{#if list.error}
		<ErrorState error={list.error} onRetry={() => list.reload()} />
	{:else if list.loading}
		<Skeleton kind="rows" rows={6} />
	{:else if months.length === 0}
		<EmptyState title="В {year} году дат нет">
			{#snippet action()}{#if canWrite}<Btn label="Добавить дату" variant="outline" colorScheme="neutral" onclick={() => open(null)} />{/if}{/snippet}
		</EmptyState>
	{:else}
		<div class="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
			{#each months as m (m.month)}
				<section class="overflow-hidden rounded-lg border border-line bg-surface" aria-label={m.title}>
					<h2 class="t-body-m-strong border-b border-line bg-surface-2 px-4 py-2 capitalize max-md:px-3">{m.title}</h2>
					<ul class="m-0 flex list-none flex-col p-0">
						{#each m.items as h (h.id)}
							{@const d = parse(h.date)}
							<li class="flex min-h-14 items-center gap-3 border-b border-line px-4 py-1.5 last:border-b-0 max-md:gap-2 max-md:px-3">
								<span class="flex w-14 flex-none flex-col items-center leading-tight">
									<span class="t-h4">{d.getDate()}</span>
									<span class="t-desc-s text-soft">{dayName.format(d)}</span>
								</span>
								<span class="t-body-m min-w-0 flex-1 wrap-anywhere">{h.name}</span>
								{#if h.is_working_day}<StatusChip label="Рабочий день" tone="warning" />{:else}<StatusChip label="Выходной" tone="info" />{/if}
								{#if canWrite}<IconBtn icon={Edit} label="Изменить" onclick={() => open(h)} />{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</CatalogPage>

<HolidayDrawer open={drawerOpen} item={editing} {presetDate} onClose={() => (drawerOpen = false)} onSaved={() => void list.reload()} />
