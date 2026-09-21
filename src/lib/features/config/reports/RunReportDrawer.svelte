<script lang="ts">
	// Запуск отчёта: формат, параметры, «Запустить» → ожидание → «Скачать». Панель остаётся открытой до результата.
	import { untrack } from 'svelte';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { CheckLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { FormDrawer, Notice } from '$lib/ui';
	import { count } from '$lib/utils/format';
	import type { ReportTemplate } from '../types';
	import ParamsForm, { type WorkflowOption } from './ParamsForm.svelte';
	import { REPORT_FORMATS, REPORT_FORMAT_LABELS, normalizeParams, paramsFor, validateParams, type ReportFormat } from './params';
	import { useReportRun } from './run.svelte';

	interface Props {
		template: ReportTemplate | null;
		onClose: () => void;
	}

	let { template, onClose }: Props = $props();

	const run = useReportRun();
	let format = $state<ReportFormat>('xlsx');
	let values = $state<Record<string, unknown>>({});
	let errors = $state<Record<string, string>>({});
	let workflows = $state<WorkflowOption[]>([]);

	const defs = $derived(template ? paramsFor(template.code, template.default_params) : []);
	const formats = $derived(REPORT_FORMATS.filter((f) => template?.output_formats.includes(f)));
	const busy = $derived(run.phase === 'running');

	$effect(() => {
		const t = template;
		if (!t) return;
		untrack(() => {
			run.reset();
			format = (t.output_formats.includes('xlsx') ? 'xlsx' : t.output_formats[0]) as ReportFormat;
			values = { ...t.default_params };
			errors = {};
			if (paramsFor(t.code).some((d) => d.kind === 'workflow') && workflows.length === 0) {
				unwrap(api.GET('/api/workflows', { params: { query: { state: 'published', limit: 100 } } }))
					.then((r) => (workflows = r.items.map((w) => ({ id: w.id, name: w.name, deal_type: w.deal_type }))))
					.catch(() => {});
			}
		});
	});

	function start() {
		if (!template || busy || run.cooldown) return;
		errors = validateParams(defs, values);
		if (Object.keys(errors).length) return;
		void run.run(template.code, format, normalizeParams(defs, values));
	}
</script>

<FormDrawer
	open={template !== null}
	title={template?.name ?? ''}
	width={460}
	saveLabel={run.phase === 'done' ? 'Скачать' : run.phase === 'failed' ? 'Повторить' : 'Запустить'}
	cancelLabel={run.phase === 'done' ? 'Закрыть' : 'Отмена'}
	showSave={run.phase !== 'running'}
	canSave={run.phase === 'done' || !run.cooldown}
	saving={busy}
	onSave={run.phase === 'done' ? () => run.download() : start}
	onClose={() => (busy ? undefined : onClose())}
>
	{#if template}
		{#if run.phase === 'form' || run.phase === 'failed'}
			<div class="flex flex-col gap-4">
				{#if template.description}<p class="t-body-s text-muted">{template.description}</p>{/if}
				{#if formats.length > 1}
					<div class="flex flex-col gap-1.5">
						<span class="t-desc-l text-muted">Формат</span>
						<SegmentedControl class="self-start" size="m" value={format} onChange={(v: string) => (format = v as ReportFormat)}>
							{#each formats as f (f)}<Segment index={f} label={REPORT_FORMAT_LABELS[f]} />{/each}
						</SegmentedControl>
					</div>
				{/if}
				<ParamsForm {defs} bind:values {errors} {workflows} />
				{#if run.phase === 'failed'}<Notice class="shrink-0" tone="error">{run.message}</Notice>{/if}
			</div>
		{:else if run.phase === 'running'}
			<div class="flex flex-col gap-3 py-8 text-center" aria-busy="true">
				<Progress indeterminate label="Формируем отчёт…" />
				<p class="t-desc-l text-muted">Обычно это занимает несколько секунд</p>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-3 py-8 text-center">
				<span class="inline-flex size-12 items-center justify-center rounded-full bg-success-soft"><CheckLarge class="size-6 fill-success" /></span>
				<p class="t-body-l-strong">Отчёт готов</p>
				{#if run.job?.row_count != null}<p class="t-desc-l text-muted">{count(run.job.row_count, ['строка', 'строки', 'строк'])}</p>{/if}
			</div>
		{/if}
	{/if}
</FormDrawer>
