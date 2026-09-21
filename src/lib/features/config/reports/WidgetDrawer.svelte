<script lang="ts">
	// Виджет дашборда: тип (показатель / график / таблица), отчёт, параметры, ширина. Данные берутся из файла отчёта при «Обновить данные».
	import { untrack } from 'svelte';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { api, unwrap } from '$lib/api';
	import { toast } from '$lib/ui';
	import type { DashboardWidget, ReportTemplate } from '../types';
	import { FormDrawer } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { toFormFailure } from '../shared/form-errors';
	import ParamsForm, { type WorkflowOption } from './ParamsForm.svelte';
	import { WIDGET_TYPES, WIDGET_TYPE_LABELS, WIDGET_WIDTHS, normalizeParams, normalizePosition, paramsFor, type WidgetType } from './params';
	import { canChart, readConfig, sumColumnsOf } from './widgets';

	interface Props {
		open: boolean;
		dashboardId: string;
		widget: DashboardWidget | null;
		templates: readonly ReportTemplate[];
		workflows: readonly WorkflowOption[];
		/** порядковый номер для нового виджета (`position.y`) */
		nextIndex: number;
		onClose: () => void;
		onSaved: () => void;
	}

	let { open, dashboardId, widget, templates, workflows, nextIndex, onClose, onSaved }: Props = $props();

	let type = $state<WidgetType>('stat_tile');
	let code = $state<string | null>(null);
	let values = $state<Record<string, unknown>>({});
	let metric = $state<string>('rows');
	let title = $state('');
	let width = $state('6');
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);

	const isNew = $derived(widget === null);
	const available = $derived(templates.filter((t) => t.is_active && (type !== 'report_chart' || canChart(t.code))));
	const defs = $derived(code ? paramsFor(code, templates.find((t) => t.code === code)?.default_params) : []);
	const metricItems = $derived([{ key: 'rows', value: 'Число строк в отчёте' }, ...sumColumnsOf(code ?? '').map((c) => ({ key: `sum:${c}`, value: `Сумма: ${c}` }))]);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			const cfg = widget ? readConfig(widget.config) : null;
			type = (widget?.widget_type as WidgetType | undefined) ?? 'stat_tile';
			code = cfg?.template_code ?? null;
			values = { ...(cfg?.params ?? {}) };
			metric = cfg?.metric ?? 'rows';
			title = cfg?.title ?? '';
			width = String(widget ? normalizePosition(widget.position).w : 6);
			errors = {};
			formError = null;
		});
	});

	function setType(next: string) {
		type = next as WidgetType;
		if (code && type === 'report_chart' && !canChart(code)) code = null;
	}

	async function save() {
		const next: Record<string, string> = {};
		if (!code) next.template_code = 'Выберите отчёт';
		errors = next;
		if (!code) return;
		saving = true;
		formError = null;
		try {
			const params = normalizeParams(defs, values);
			const config: Record<string, unknown> = { template_code: code, params, ...(title.trim() ? { title: title.trim() } : {}), ...(type === 'stat_tile' ? { metric } : {}) };
			const position = { ...(widget ? normalizePosition(widget.position) : { x: 0, y: nextIndex, h: 1 }), w: Number(width) };
			if (widget) await unwrap(api.PATCH('/api/dashboards/{dashboard_id}/widgets/{widget_id}', { params: { path: { dashboard_id: dashboardId, widget_id: widget.id } }, body: { widget_type: type, config, position } }));
			else await unwrap(api.POST('/api/dashboards/{dashboard_id}/widgets', { params: { path: { dashboard_id: dashboardId } }, body: { widget_type: type, config, position } }));
			toast.success(widget ? 'Виджет сохранён' : 'Виджет добавлен');
			onSaved();
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['widget_type', 'config']);
			errors = failure.fields;
			formError = failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormDrawer {open} title={isNew ? 'Новый виджет' : 'Виджет'} {saving} {formError} saveLabel={isNew ? 'Добавить' : 'Сохранить'} onSave={save} {onClose}>
	<div class="flex flex-col gap-1.5">
		<span class="t-desc-l text-muted">Что показать</span>
		<SegmentedControl class="self-start" size="m" value={type} onChange={setType}>
			{#each WIDGET_TYPES as t (t)}<Segment index={t} label={WIDGET_TYPE_LABELS[t]} />{/each}
		</SegmentedControl>
	</div>
	<Pick label="Отчёт" search bind:value={code} items={available.map((t) => ({ key: t.code, value: t.name }))} error={errors.template_code} hint={type === 'report_chart' ? 'График доступен для отчётов с числовыми колонками' : undefined} />
	{#if code}
		<ParamsForm {defs} bind:values {workflows} />
		{#if type === 'stat_tile'}<Pick label="Показатель" bind:value={metric} items={metricItems} />{/if}
	{/if}
	<TextField label="Заголовок (необязательно)" bind:value={title} maxlength={120} />
	<div class="flex flex-col gap-1.5">
		<span class="t-desc-l text-muted">Ширина</span>
		<SegmentedControl class="self-start" size="m" value={width} onChange={(v: string) => (width = v)}>
			{#each WIDGET_WIDTHS as w (w.key)}<Segment index={String(w.key)} label={w.value} />{/each}
		</SegmentedControl>
	</div>
</FormDrawer>
