<script lang="ts">
	// Шаг 3: проверка без записи. Итог тремя плитками, отчёт об ошибках (.xlsx), «Применить N строк» — только если есть что применять.
	import { Loader } from '@lct-testkit/rt-ui';
	import { Download } from '@lct-testkit/rt-ui/icons';
	import { Btn, ErrorState, WizardCard, toast } from '$lib/ui';
	import { count } from '$lib/utils/format';
	import type { ImportFlow } from './flow.svelte';
	import JobSummary from './JobSummary.svelte';
	import { openErrorReport } from './job';
	import { canApplyImport } from './mapping';

	let { flow }: { flow: ImportFlow } = $props();

	const job = $derived(flow.job);
	const validated = $derived(job?.status === 'validated');
	const rows = $derived(job ? job.ok_rows + job.warn_rows : 0);
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
</script>

{#if flow.error}
	<WizardCard>
		<ErrorState error={flow.error} onRetry={() => flow.dryRun()} compact />
		{#snippet actions()}
			<Btn label="К сопоставлению" variant="outline" colorScheme="neutral" onclick={() => (flow.step = 1)} />
		{/snippet}
	</WizardCard>
{:else if flow.busy || !job || !validated}
	<WizardCard>
		<div class="flex flex-col items-center gap-3 py-8" aria-busy="true">
			<Loader size="m" />
			<p class="t-body-m text-muted">Проверяем строки…</p>
		</div>
	</WizardCard>
{:else}
	<WizardCard>
		<JobSummary {job} />
		{#if job.error_rows > 0}
			<div class="flex flex-wrap items-center gap-3 rounded-md bg-surface-2 px-3 py-2.5">
				<p class="t-body-s min-w-0 flex-1">Строки с ошибками будут пропущены — остальные загрузятся.</p>
				{#if job.result_file_id}<Btn label="Отчёт об ошибках" icon={Download} size="s" variant="outline" colorScheme="neutral" loading={downloading} onclick={report} />{/if}
			</div>
		{/if}
		{#snippet actions()}
			<Btn label={rows > 0 ? `Применить ${count(rows, ['строку', 'строки', 'строк'])}` : 'Нечего применять'} disabled={!canApplyImport(job)} loading={flow.busy} onclick={() => flow.apply()} />
			<Btn label="К сопоставлению" variant="outline" colorScheme="neutral" onclick={() => (flow.step = 1)} />
		{/snippet}
	</WizardCard>
{/if}
