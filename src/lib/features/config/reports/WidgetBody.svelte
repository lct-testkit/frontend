<script lang="ts">
	// Содержимое виджета по его типу и таблице отчёта: показатель, график (столбцы / линии / кольцо) или мини-таблица.
	import { BarChart, DonutChart, LineChart } from '@lct-testkit/rt-ui/charts';
	import { formatMoneyShort, formatNumber } from '$lib/utils/format';
	import type { XlsxTable } from './xlsx';
	import { CHART_PRESETS, chartRows, metricLabel, previewRows, tileValue, type WidgetConfig } from './widgets';

	interface Props {
		type: string;
		config: WidgetConfig;
		table: XlsxTable;
		name: string;
	}

	let { type, config, table, name }: Props = $props();

	const preset = $derived(CHART_PRESETS[config.template_code]);
	const rows = $derived(preset ? chartRows(table, preset) : []);
	const tile = $derived(tileValue(table, config.metric));
	const money = $derived(Boolean(config.metric?.toLowerCase().includes('сумма')));
	const preview = $derived(previewRows(table, 8));
	const series = $derived(preset?.series.map((s) => ({ key: s, label: s, y: s })) ?? []);
</script>

{#if type === 'stat_tile'}
	<div class="flex flex-col gap-1 py-2">
		<span class="t-h1 tabular-nums">{tile === null ? '—' : money ? formatMoneyShort(tile) : formatNumber(tile)}</span>
		<span class="t-desc-l text-muted">{metricLabel(config.metric)}</span>
	</div>
{:else if type === 'report_chart' && preset}
	{#if rows.length === 0}
		<p class="t-body-s py-6 text-center text-soft">В отчёте нет данных для графика</p>
	{:else if preset.kind === 'donut'}
		<div class="flex justify-center"><DonutChart data={rows} name="name" value={preset.series[0]} size={180} label={name} /></div>
	{:else if preset.kind === 'line'}
		<LineChart data={rows} x="name" {series} smooth height={220} label={name} />
	{:else}
		<BarChart data={rows} x="name" {series} horizontal={preset.horizontal} height={preset.horizontal ? Math.min(420, Math.max(180, rows.length * 24)) : 220} label={name} />
	{/if}
{:else}
	{#if preview.rows.length === 0}
		<p class="t-body-s py-6 text-center text-soft">В отчёте нет строк</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="t-body-s w-full border-collapse text-left">
				<thead>
					<tr>
						{#each preview.columns.slice(0, 5) as c (c)}<th class="t-desc-l border-b border-line px-2 py-1.5 font-normal whitespace-nowrap text-muted">{c}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each preview.rows as row, i (i)}
						<tr>
							{#each row.slice(0, 5) as cell, k (k)}<td class="max-w-48 truncate border-b border-line px-2 py-1.5">{cell ?? '—'}</td>{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if table.rows.length > preview.rows.length}<p class="t-desc-m pt-1.5 text-soft">Показано {preview.rows.length} из {table.rows.length}</p>{/if}
	{/if}
{/if}
