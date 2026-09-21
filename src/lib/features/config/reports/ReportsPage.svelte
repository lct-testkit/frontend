<script lang="ts">
	// Виды отчётов: карточки; клик открывает панель запуска. Шаблоны, недоступные роли, сервер уже отфильтровал.
	import { onMount } from 'svelte';
	import { Badge } from '@lct-testkit/rt-ui';
	import { ArrowRight } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { ErrorState, EmptyState, Page, PageHeader, Skeleton } from '$lib/ui';
	import type { ReportTemplate } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import ReportTabs from './ReportTabs.svelte';
	import RunReportDrawer from './RunReportDrawer.svelte';
	import { REPORT_FORMAT_LABELS, type ReportFormat } from './params';

	const list = createResource((signal) => unwrap(api.GET('/api/report-templates', { signal })).then((r) => r.items.filter((t) => t.is_active)));
	onMount(() => void list.reload());

	let selected = $state<ReportTemplate | null>(null);
</script>

<Page>
	<PageHeader title="Отчёты">
		{#snippet tabs(underline)}<ReportTabs active="gallery" {underline} />{/snippet}
	</PageHeader>

	{#if list.error}
		<ErrorState error={list.error} onRetry={() => list.reload()} />
	{:else if list.loading}
		<div class="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
			{#each [0, 1, 2, 3, 4, 5] as i (i)}<Skeleton kind="tile" rows={1} height={128} />{/each}
		</div>
	{:else if (list.data ?? []).length === 0}
		<EmptyState title="Отчётов пока нет" />
	{:else}
		<ul class="m-0 grid list-none grid-cols-3 gap-3 p-0 max-lg:grid-cols-2 max-md:grid-cols-1">
			{#each list.data ?? [] as t (t.id)}
				<li class="flex">
					<!-- карточка-кнопка целиком: в rt-ui нет кликабельной карточки -->
					<button
						type="button"
						class="group m-0 flex w-full cursor-pointer appearance-none flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-left font-[inherit] text-[inherit] transition-colors hover:border-line-strong hover:bg-surface-2 max-md:p-3"
						onclick={() => (selected = t)}
					>
						<span class="flex items-start justify-between gap-2">
							<span class="t-body-l-strong min-w-0 wrap-anywhere">{t.name}</span>
							<ArrowRight class="size-5 flex-none fill-soft transition-transform group-hover:translate-x-0.5" />
						</span>
						{#if t.description}<span class="t-body-s line-clamp-3 text-muted">{t.description}</span>{/if}
						<span class="mt-auto flex flex-wrap gap-1.5 pt-1">
							{#each t.output_formats as f (f)}<Badge size="2xs" variant="secondary" colorScheme="neutral" label={REPORT_FORMAT_LABELS[f as ReportFormat]} />{/each}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Page>

<RunReportDrawer template={selected} onClose={() => (selected = null)} />
