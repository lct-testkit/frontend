<script lang="ts">
	// Плашка «Состояние системы»: общий статус и зависимости чипами с задержкой ответа. Обновляется раз в 30 секунд и по кнопке.
	import { onDestroy, onMount } from 'svelte';
	import { Loader } from '@lct-testkit/rt-ui';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { IconBtn, StatusChip } from '$lib/ui';
	import { HEALTH_DEPENDENCY_LABELS, HEALTH_STATUSES, labelOf } from '../labels';
	import type { HealthReport } from '../types';
	import { createPoller } from '../shared/polling.svelte';
	import { fetchHealth, healthTone } from './health';

	let report = $state<HealthReport | null>(null);
	let loading = $state(true);

	async function load() {
		loading = true;
		try {
			report = await fetchHealth();
		} finally {
			loading = false;
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
		<StatusChip label={labelOf(HEALTH_STATUSES, report.status)} tone={healthTone(report.status)} />
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
	<IconBtn icon={Refresh} label="Проверить сейчас" disabled={loading} onclick={load} class="ml-auto" />
</section>
