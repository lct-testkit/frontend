<script lang="ts">
	// Дашборды: мои и общие. «Создать дашборд» — название и признак «Общий»; открыть — клик по карточке.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { AddLarge, ChevronRight } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, DateText, EmptyState, ErrorState, Page, PageHeader, Skeleton, StatusChip } from '$lib/ui';
	import UserName from '$lib/ui/UserName.svelte';
	import type { Dashboard } from '../types';
	import DashboardDrawer from './DashboardDrawer.svelte';
	import ReportTabs from './ReportTabs.svelte';

	const pager = createPager<Dashboard>((cursor, signal) => unwrap(api.GET('/api/dashboards', { params: { query: { limit: 50, cursor } }, signal })));
	onMount(() => void pager.reload());

	const canCreate = $derived(session.can('report:create') || session.can('report:read'));
	let creating = $state(false);
</script>

<Page>
	<PageHeader title="Отчёты" primary={canCreate ? { label: 'Создать дашборд', onclick: () => (creating = true) } : undefined}>
		{#snippet tabs(underline)}<ReportTabs active="dashboards" {underline} />{/snippet}
	</PageHeader>

	{#if pager.error}
		<ErrorState error={pager.error} onRetry={() => pager.reload()} />
	{:else if pager.loading}
		<div class="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
			{#each [0, 1, 2] as i (i)}<Skeleton kind="tile" rows={1} height={96} />{/each}
		</div>
	{:else if pager.items.length === 0}
		<EmptyState title="Дашбордов пока нет">
			{#snippet action()}{#if canCreate}<Btn label="Создать дашборд" icon={AddLarge} onclick={() => (creating = true)} />{/if}{/snippet}
		</EmptyState>
	{:else}
		<ul class="m-0 grid list-none grid-cols-3 gap-3 p-0 max-lg:grid-cols-2 max-md:grid-cols-1">
			{#each pager.items as d (d.id)}
				<li class="flex">
					<!-- карточка-кнопка целиком: в rt-ui нет кликабельной карточки -->
					<button
						type="button"
						class="group m-0 flex w-full cursor-pointer appearance-none flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-left font-[inherit] text-[inherit] transition-colors hover:border-line-strong hover:bg-surface-2 max-md:p-3"
						onclick={() => goto(`/reports/dashboards/${d.id}`)}
					>
						<span class="flex items-start justify-between gap-2">
							<span class="t-body-l-strong min-w-0 wrap-anywhere">{d.name}</span>
							<ChevronRight class="size-5 flex-none fill-soft" />
						</span>
						<span class="t-desc-l flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
							{#if d.is_shared}<StatusChip label="Общий" tone="info" />{/if}
							{#if d.owner_id !== session.me?.id}<UserName id={d.owner_id} />{/if}
							<span>Изменён <DateText value={d.updated_at} /></span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if pager.hasMore}<div class="flex justify-center"><Btn label="Показать ещё" variant="outline" colorScheme="neutral" loading={pager.loadingMore} onclick={() => pager.loadMore()} /></div>{/if}
	{/if}
</Page>

<DashboardDrawer
	open={creating}
	item={null}
	onClose={() => (creating = false)}
	onSaved={(d) => {
		void goto(`/reports/dashboards/${d.id}`);
	}}
/>
