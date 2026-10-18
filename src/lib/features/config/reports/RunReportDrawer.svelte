<script lang="ts">
	// Запуск отчёта: формат, параметры, «Запустить» → ожидание → «Скачать». Панель остаётся открытой до результата.
	import { untrack } from 'svelte';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { CheckLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { FormDrawer, Notice } from '$lib/ui';
	import { count } from '$lib/utils/format';
	import type { ReportTemplate } from '../types';
	import ParamsForm, { type WorkflowOption } from './ParamsForm.svelte';
	import { REPORT_SPECS, defaultFormat, describeTemplate, formatHint, formatLabel, formatsFor, normalizeParams, paramsFor, validateParams } from './params';
	import { cleanSelection } from './columns';
	import { columnsKey, formatKey, recall, recallStrings, remember } from './memory';
	import { jobNoteInput, reportNotes } from './notes';
	import ReportNotes from './ReportNotes.svelte';
	import { useReportRun } from './run.svelte';

	interface Props {
		template: ReportTemplate | null;
		onClose: () => void;
	}

	let { template, onClose }: Props = $props();

	const run = useReportRun();
	let format = $state('xlsx');
	let values = $state<Record<string, unknown>>({});
	let errors = $state<Record<string, string>>({});
	let workflows = $state<WorkflowOption[]>([]);

	const defs = $derived(template ? paramsFor(template.code, template.default_params, { dateFields: template.date_fields, defaultDateField: template.default_date_field, columns: template.columns }) : []);
	const spec = $derived(template ? REPORT_SPECS[template.code] : undefined);
	const hasScope = $derived(defs.some((d) => d.group === 'scope'));
	const formats = $derived(formatsFor(template?.output_formats ?? []));
	const busy = $derived(run.phase === 'running');
	const notes = $derived(run.job ? reportNotes(jobNoteInput(run.job, session.isRole('ADMIN'))) : []);

	$effect(() => {
		const t = template;
		if (!t) return;
		untrack(() => {
			run.reset();
			const past = recall(formatKey(t.code));
			format = defaultFormat(formatsFor(t.output_formats), typeof past === 'string' ? past : null);
			values = { ...t.default_params };
			// прошлый набор колонок этого отчёта (ТЗ Функц.13: кэш действий пользователя)
			const columnDef = paramsFor(t.code, t.default_params, { columns: t.columns }).find((d) => d.kind === 'columns');
			const pastColumns = recallStrings(columnsKey(t.code));
			if (columnDef && pastColumns) {
				const kept = cleanSelection(pastColumns, columnDef.options ?? []);
				if (kept.length) values = { ...values, columns: kept };
			}
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
		errors = validateParams(defs, values, { workflowTypes: Object.fromEntries(workflows.map((w) => [w.id, w.deal_type])) });
		if (Object.keys(errors).length) return;
		const body = normalizeParams(defs, values);
		remember(columnsKey(template.code), Array.isArray(body.columns) ? body.columns : undefined);
		remember(formatKey(template.code), format);
		void run.run(template.code, format, body);
	}
</script>

<FormDrawer
	open={template !== null}
	title={template?.name ?? ''}
	width={hasScope ? 560 : 460}
	saveLabel={run.phase === 'done' ? 'Скачать' : run.phase === 'failed' ? 'Повторить' : 'Запустить'}
	cancelLabel={run.phase === 'done' ? 'Закрыть' : 'Отмена'}
	showSave={run.phase !== 'running'}
	canSave={run.phase === 'done' || !run.cooldown}
	saving={busy}
	dirty={run.phase === 'form' ? undefined : false}
	onSave={run.phase === 'done' ? () => run.download() : start}
	onClose={() => (busy ? undefined : onClose())}
>
	{#if template}
		{#if run.phase === 'form' || run.phase === 'failed'}
			<div class="flex flex-col gap-4">
				{#if template.description}<p class="t-body-s text-muted">{describeTemplate(template.description)}</p>{/if}
				{#if spec?.hint && (!spec.hintRoles || spec.hintRoles.some((r) => session.isRole(r)))}<p class="t-desc-l text-muted">{spec.hint}</p>{/if}
				{#if spec?.personalData}<Notice class="shrink-0" tone="warning">Отчёт содержит персональные данные. Не передавайте файл посторонним</Notice>{/if}
				{#if formats.length > 1}
					<div class="flex flex-col gap-1.5" role="group" aria-labelledby="report-format-label">
						<span id="report-format-label" class="t-desc-l text-muted">Формат</span>
						<SegmentedControl class="max-w-full self-start" size="m" value={format} onChange={(v: string) => (format = v)}>
							{#each formats as f (f)}<Segment index={f} label={formatLabel(f)} />{/each}
						</SegmentedControl>
						{#if formatHint(format)}<span class="t-desc-l text-muted">{formatHint(format)}</span>{/if}
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
				<div class="flex w-full flex-col gap-2 text-left"><ReportNotes {notes} /></div>
			</div>
		{/if}
	{/if}
</FormDrawer>
