<script lang="ts">
	// Карточка задания: итоги, сопоставление колонок, отчёт об ошибках, откат. Пока задание в работе — ход обновляется опросом.
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { Download } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { Btn, DateText, ErrorState, Page, PageHeader, Skeleton, StatusChip, confirm, toast } from '$lib/ui';
	import UserName from '$lib/ui/UserName.svelte';
	import type { ImportJob } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import { createPoller } from '../shared/polling.svelte';
	import ImportRows from './ImportRows.svelte';
	import JobSummary from './JobSummary.svelte';
	import { entityLabel, isDraftJob, jobStatus, loadEntityTypes, modeLabel, openErrorReport, resultHref, resultLabel } from './job';
	import { canRollbackImport, isImportBusy, type ImportEntityType } from './mapping';

	let { id }: { id: string } = $props();

	const job = createResource<ImportJob>((signal) => unwrap(api.GET('/api/imports/{job_id}', { params: { path: { job_id: id } }, signal })));
	const poller = createPoller(async () => {
		const fresh = await unwrap(api.GET('/api/imports/{job_id}', { params: { path: { job_id: id } } }));
		job.set(fresh);
		return isImportBusy(fresh.status);
	});
	let entityTypes = $state<ImportEntityType[]>([]);
	onMount(async () => {
		// подписи полей для сопоставления колонок; без них показываются коды полей
		void loadEntityTypes().then((types) => (entityTypes = types)).catch(() => {});
		const j = await job.reload();
		if (j && isImportBusy(j.status)) poller.start();
	});
	onDestroy(() => poller.stop());

	const j = $derived(job.data);
	const busy = $derived(j ? isImportBusy(j.status) : false);
	const mapped = $derived.by(() => {
		if (!j) return [];
		const labels = new Map((entityTypes.find((t) => t.code === j.entity_type)?.fields ?? []).map((f) => [f.target, f.label]));
		return Object.entries(j.mapping ?? {}).map(([column, target]) => ({ column, label: labels.get(target) ?? target }));
	});
	let acting = $state(false);

	async function rollback() {
		if (!j) return;
		if (!(await confirm({ title: 'Откатить импорт?', message: 'Созданные записи будут удалены, изменённые — возвращены к прежним значениям.', confirmLabel: 'Откатить', danger: true }))) return;
		acting = true;
		try {
			job.set(await unwrap(api.POST('/api/imports/{job_id}/rollback', { params: { path: { job_id: id } } })));
			poller.start();
		} catch (e) {
			toast.error(e, 'Не удалось откатить импорт');
		} finally {
			acting = false;
		}
	}
</script>

<Page narrow class="max-w-4xl!">
	<PageHeader title={j ? `Импорт: ${entityLabel(j.entity_type)}` : 'Импорт'} back="/imports">
		{#snippet meta()}{#if j}<StatusChip label={jobStatus(j.status).label} tone={jobStatus(j.status).tone} />{/if}{/snippet}
	</PageHeader>

	{#if job.error}
		<ErrorState error={job.error} onRetry={() => job.reload()} />
	{:else if job.loading || !j}
		<Skeleton kind="rows" rows={5} />
	{:else}
		<section class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 max-md:p-3">
			{#if busy}
				<Progress indeterminate label={j.status === 'rolling_back' ? 'Откатываем импорт…' : 'Применяем импорт…'} />
			{:else if isDraftJob(j)}
				<p class="t-body-m">Импорт не доведён до конца.</p>
			{:else}
				<JobSummary job={j} done={j.status !== 'validated'} />
			{/if}

			<dl class="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1.5 max-md:grid-cols-1 max-md:gap-y-0.5">
				<dt class="t-desc-l text-muted">Режим</dt>
				<dd class="t-body-s m-0 max-md:mb-1.5">{modeLabel(j.mode)}</dd>
				<dt class="t-desc-l text-muted">Формат файла</dt>
				<dd class="t-body-s m-0 max-md:mb-1.5">{j.source_format.toUpperCase()}</dd>
				<dt class="t-desc-l text-muted">Кто загрузил</dt>
				<dd class="t-body-s m-0 max-md:mb-1.5"><UserName id={j.initiated_by} /></dd>
				<dt class="t-desc-l text-muted">Создан</dt>
				<dd class="t-body-s m-0 max-md:mb-1.5"><DateText value={j.created_at} time /></dd>
				{#if j.finished_at}
					<dt class="t-desc-l text-muted">Завершён</dt>
					<dd class="t-body-s m-0 max-md:mb-1.5"><DateText value={j.finished_at} time /></dd>
				{/if}
				{#if j.rolled_back_at}
					<dt class="t-desc-l text-muted">Откачен</dt>
					<dd class="t-body-s m-0"><DateText value={j.rolled_back_at} time /></dd>
				{/if}
			</dl>

			<div class="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse max-md:[&_button]:w-full">
				{#if j.result_file_id}
					<Btn label="Отчёт об ошибках" icon={Download} variant="outline" colorScheme="neutral" onclick={() => openErrorReport(j).catch((e) => toast.error(e))} />
				{/if}
				{#if canRollbackImport(j)}<Btn label="Откатить импорт" variant="outline" colorScheme="neutral" danger loading={acting} onclick={rollback} />{/if}
				{#if isDraftJob(j)}
					<Btn label="Продолжить" onclick={() => goto(`/imports/new?job=${j.id}`)} />
				{:else if j.status !== 'rolled_back' && !busy}
					<Btn label={`Открыть: ${resultLabel(j.entity_type)}`} onclick={() => goto(resultHref(j.entity_type))} />
				{/if}
			</div>
		</section>

		{#if !busy && !isDraftJob(j) && j.total_rows > 0}
			{#key j.status}<ImportRows jobId={j.id} total={j.total_rows} warn={j.warn_rows} error={j.error_rows} />{/key}
		{/if}

		{#if mapped.length}
			<section class="flex flex-col gap-2" aria-label="Сопоставление колонок">
				<h2 class="t-h5">Сопоставление колонок</h2>
				<ul class="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-line bg-surface p-0">
					{#each mapped as m (m.column)}
						<li class="flex items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0 max-md:px-3"><span class="t-body-s min-w-0 wrap-anywhere">{m.column}</span><span class="t-body-s-strong flex-none">{m.label}</span></li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</Page>
