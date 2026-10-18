<script lang="ts">
	// Шаги 4–5: применение (фоновая задача) и итог. Откат — с подтверждением; ход отката и применения — опросом задания.
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { CheckLarge, Download } from '@lct-testkit/rt-ui/icons';
	import { goto } from '$app/navigation';
	import { Btn, Notice, WizardCard, confirm, toast } from '$lib/ui';
	import { formatNumber } from '$lib/utils/format';
	import type { ImportFlow } from './flow.svelte';
	import CheckSummary from './CheckSummary.svelte';
	import type { ImportSummary } from './check';
	import ImportRows from './ImportRows.svelte';
	import JobSummary from './JobSummary.svelte';
	import { entityLabel, loadImportSummary, openErrorReport, resultHref, resultLabel } from './job';
	import { canRollbackImport } from './mapping';

	let { flow }: { flow: ImportFlow } = $props();

	const job = $derived(flow.job);
	const applying = $derived(job?.status === 'applying');
	const rolling = $derived(job?.status === 'rolling_back');

	// итог по строкам: что создано, обновлено, пропущено (после применения сервер дополняет сводку проверки)
	let summary = $state<ImportSummary | null>(null);
	let issue = $state<{ code: string; message: string } | null>(null);
	$effect(() => {
		const id = job?.id;
		const status = job?.status;
		if (!id || (status !== 'completed' && status !== 'completed_with_errors')) return;
		let live = true;
		void loadImportSummary(id).then((s) => live && (summary = s)).catch(() => {});
		return () => (live = false);
	});
	let downloading = $state(false);
	async function report() {
		if (!job) return;
		downloading = true;
		try {
			await openErrorReport(job);
		} catch (e) {
			toast.error(e, 'Не удалось скачать отчёт');
		} finally {
			downloading = false;
		}
	}

	async function rollback() {
		if (!job) return;
		const ok = await confirm({
			title: 'Откатить импорт?',
			message: `Созданные записи (${entityLabel(job.entity_type)}) будут удалены, изменённые — возвращены к прежним значениям.`,
			confirmLabel: 'Откатить',
			danger: true
		});
		if (ok) await flow.rollback();
	}
</script>

{#if !job}
	<div></div>
{:else if applying || rolling}
	<WizardCard>
		<div class="flex flex-col items-center gap-4 py-6 text-center" aria-busy="true">
			<Progress indeterminate label={rolling ? 'Откатываем импорт…' : 'Применяем импорт…'} class="w-full max-w-md" />
			<p class="t-desc-l text-muted">{formatNumber(job.ok_rows + job.warn_rows)} строк в работе — страницу можно не закрывать, ход обновляется сам</p>
		</div>
	</WizardCard>
{:else if job.status === 'failed'}
	<WizardCard>
		<Notice tone="error" class="w-full shrink-0">Не удалось выполнить импорт. Записи не изменены или откачены; попробуйте загрузить файл заново.</Notice>
		{#snippet actions()}
			<Btn label="Новый импорт" onclick={() => goto('/imports/new')} />
		{/snippet}
	</WizardCard>
{:else}
	<WizardCard>
		<div class="flex items-center gap-3">
			<span class="inline-flex size-10 flex-none items-center justify-center rounded-full bg-success-soft"><CheckLarge class="size-5 fill-success" /></span>
			<h2 class="t-h4">{job.status === 'rolled_back' ? 'Импорт откачен' : job.status === 'completed_with_errors' ? 'Импорт завершён с пропусками' : 'Импорт завершён'}</h2>
		</div>
		{#if job.status !== 'rolled_back'}<JobSummary {job} done />{/if}
		{#if summary && job.status !== 'rolled_back'}<CheckSummary {summary} phase="applied" issue={issue?.code ?? null} onPick={(code, message) => (issue = code ? { code, message: message ?? code } : null)} />{/if}
		{#key job.status}<ImportRows jobId={job.id} total={job.total_rows} warn={job.warn_rows} error={job.error_rows} issue={issue?.code ?? null} issueLabel={issue?.message ?? null} onClearIssue={() => (issue = null)} />{/key}
		{#snippet actions()}
			{#if job.status !== 'rolled_back'}
				<Btn label={`Открыть: ${resultLabel(job.entity_type)}`} onclick={() => goto(resultHref(job.entity_type))} />
				<Btn label="Новый импорт" variant="outline" colorScheme="neutral" onclick={() => goto('/imports/new')} />
			{:else}
				<Btn label="Новый импорт" onclick={() => goto('/imports/new')} />
			{/if}
			{#if job.result_file_id && job.status !== 'rolled_back'}<Btn label="Отчёт .xlsx" icon={Download} variant="outline" colorScheme="neutral" loading={downloading} onclick={report} data-testid="import-report" />{/if}
			{#if canRollbackImport(job)}<Btn label="Откатить импорт" variant="outline" colorScheme="neutral" danger loading={flow.busy} onclick={rollback} />{/if}
		{/snippet}
	</WizardCard>
{/if}
