<script lang="ts">
	// Проверка целостности хэш-цепочки журнала: открывается и сразу проверяет последние записи; глубину можно увеличить.
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { api, unwrap, type components } from '$lib/api';
	import AppModal from '$lib/ui/AppModal.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import { count } from '$lib/utils/format';
	import { chainNote, parsePending } from './pending';

	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	type Report = components['schemas']['AuditChainReport'];

	let depth = $state('1000');
	let report = $state<Report | null>(null);
	let error = $state<unknown>(null);
	let busy = $state(false);
	// режим очереди: события, ещё не вошедшие в цепочку, проверкой не охвачены (поля читаются из сырого ответа)
	const note = $derived(chainNote(parsePending(report)));

	async function run() {
		busy = true;
		error = null;
		report = null;
		try {
			report = await unwrap(api.GET('/api/admin/audit/verify-chain', { params: { query: { limit: Number(depth) } } }));
		} catch (e) {
			error = e;
		} finally {
			busy = false;
		}
	}

	$effect(() => {
		if (open) {
			depth = '1000';
			void run();
		}
	});
</script>

<AppModal {open} title="Целостность журнала" size="s" {onClose}>
	{#if busy}
		<Skeleton kind="lines" rows={2} />
	{:else if error}
		<ErrorState {error} onRetry={run} compact />
	{:else if report}
		<Notice class="shrink-0" tone={report.ok ? 'success' : 'error'} role="status" title={report.ok ? (note ? 'Цепочка цела для запечатанных записей' : 'Цепочка цела') : 'Найдены нарушения'} data-testid="chain-result" data-ok={report.ok}>Проверено {count(report.checked, ['запись', 'записи', 'записей'])}</Notice>
		{#if note}<p class="t-body-s m-0 text-muted" data-testid="chain-pending">{note}</p>{/if}
		{#if report.problems.length}
			<ul class="t-body-s m-0 flex list-disc flex-col gap-1 pl-5">
				{#each report.problems.slice(0, 20) as p (p)}<li class="break-words">{p}</li>{/each}
			</ul>
		{/if}
	{/if}
	<div class="flex flex-wrap items-center gap-2">
		<span class="t-desc-l text-muted">Глубина</span>
		<SegmentedControl value={depth} onChange={(v) => ((depth = v), void run())} size="s">
			<Segment index="1000" label="1 000" />
			<Segment index="5000" label="5 000" />
			<Segment index="20000" label="20 000" />
		</SegmentedControl>
	</div>
	{#snippet footer()}
		<Btn label="Закрыть" onclick={onClose} />
	{/snippet}
</AppModal>
