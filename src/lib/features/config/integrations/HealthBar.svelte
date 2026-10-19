<script lang="ts">
	// Плашка «Состояние системы»: общий статус и зависимости чипами с задержкой ответа. Обновляется раз в 30 секунд и по кнопке.
	import { onDestroy, onMount } from 'svelte';
	import { Loader } from '@lct-testkit/rt-ui';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { Btn, IconBtn, StatusChip } from '$lib/ui';
	import { formatTime } from '$lib/utils/format';
	import { HEALTH_DEPENDENCY_LABELS, HEALTH_STATUSES, labelOf } from '../labels';
	import type { HealthReport } from '../types';
	import { createPoller } from '../shared/polling.svelte';
	import { api, unwrap } from '$lib/api';
	import { coalesce } from '$lib/api/coalesce';
	import { SourceChecks } from './check.svelte';
	import { fetchHealth, healthTone } from './health';
	import { sourcesSummary, type SourcesSummary } from './sourceState';

	let report = $state<HealthReport | null>(null);
	let loading = $state(true);
	let sources = $state<SourcesSummary | null>(null);
	let sourceList = $state<{ code: string; name: string; is_active: boolean; last_error: string | null }[]>([]);
	const checks = new SourceChecks();
	const hasActive = $derived(sourceList.some((s) => s.is_active));
	/** когда плашка получила данные в последний раз («Обновить» перечитывает состояние; живая проверка внешних систем — «Проверить сейчас») */
	let updatedAt = $state<Date | null>(null);

	async function load() {
		loading = true;
		try {
			report = await fetchHealth();
			const list = await coalesce('admin-integration-sources', () => unwrap(api.GET('/api/admin/integrations/sources'))).catch(() => null);
			sourceList = list ?? [];
			sources = list ? sourcesSummary(list) : null;
			// включили или выключили источник — прежний итог проверки уже не про них
			if (checks.summary && !sourceList.some((s) => s.is_active)) checks.clear();
		} finally {
			loading = false;
			updatedAt = new Date();
		}
	}
	const poller = createPoller(async () => (await load(), true), { interval: 30_000 });
	onMount(async () => {
		await load();
		poller.start();
	});
	onDestroy(() => poller.stop());
</script>

<section class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 max-md:px-3" aria-label="Состояние системы">
	{#if report}
		<!-- Одно сообщение: при исправной системе его заменяет сводка по источникам, иначе «всё работает» спорит с «источники отключены». -->
		{#if report.status !== 'ok' || !sources}
			<StatusChip label={labelOf(HEALTH_STATUSES, report.status)} tone={healthTone(report.status)} />
		{/if}
		{#if sources}<StatusChip label={sources.text} tone={sources.tone} />{/if}
		<ul class="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-1.5 p-0 max-md:order-last max-md:basis-full">
			{#each report.dependencies as d (d.name)}
				<li class="max-w-full min-w-0">
					<StatusChip
						label={`${HEALTH_DEPENDENCY_LABELS[d.name] ?? d.name}${d.latency_ms != null ? ` · ${Math.max(1, Math.round(d.latency_ms))} мс` : ''}`}
						tone={d.ok ? 'success' : 'error'}
					/>
				</li>
			{/each}
		</ul>
	{:else}
		<span class="t-body-s inline-flex items-center gap-2 text-muted" role="status"><Loader size="2xs" />Проверяем…</span>
	{/if}
	<span class="ml-auto flex items-center gap-2">
		{#if updatedAt}<span class="t-desc-l text-muted" data-testid="health-updated">Обновлено в {formatTime(updatedAt)}</span>{/if}
		<IconBtn icon={Refresh} label="Обновить" disabled={loading} onclick={load} />
		{#if hasActive}<Btn label="Проверить сейчас" variant="outline" colorScheme="neutral" size="s" loading={checks.running} onclick={() => checks.run(sourceList)} data-testid="check-sources" />{/if}
	</span>
	{#if checks.summary}
		<!-- итог живой проверки: кто из включённых источников ответил; у неответивших — причина (бэкенд отдаёт её по-русски) -->
		<div class="flex basis-full flex-col gap-1" data-testid="check-result" role="status">
			<span class="flex flex-wrap items-center gap-2"><StatusChip label={checks.summary.text} tone={checks.summary.allOk ? 'success' : 'error'} /></span>
			{#each checks.summary.failed as r (r.code)}
				<span class="t-desc-l text-danger"><span class="font-medium">{r.name}:</span> {r.message}</span>
			{/each}
		</div>
	{/if}
</section>
