<script lang="ts">
	// Сводка за 24 часа над журналом: критичные события, неверные подписи вебхуков, блокировки. Плитка с числом ведёт в журнал с нужным фильтром.
	import type { components } from '$lib/api';
	import Tile from '$lib/ui/Tile.svelte';
	import { countOf } from './summary';

	let { summary, failed = false }: { summary: components['schemas']['SecurityEventSummaryOut'] | null; failed?: boolean } = $props();
</script>

{#if !failed}
	<div class="grid grid-cols-3 gap-3 max-md:grid-cols-1" aria-label="За 24 часа">
		<Tile label="Критичных за 24 часа" value={summary?.critical_count ?? 0} loading={!summary} tone={summary && summary.critical_count > 0 ? 'danger' : 'neutral'} href="/admin/security?severity=critical" />
		<Tile label="Неверных подписей вебхуков" value={countOf(summary, 'INTEGRATION_SIGNATURE_INVALID')} loading={!summary} tone={countOf(summary, 'INTEGRATION_SIGNATURE_INVALID') > 0 ? 'warning' : 'neutral'} href="/admin/security?type=INTEGRATION_SIGNATURE_INVALID" />
		<Tile label="Блокировок" value={countOf(summary, 'BRUTE_FORCE_LOCK')} loading={!summary} tone={countOf(summary, 'BRUTE_FORCE_LOCK') > 0 ? 'warning' : 'neutral'} href="/admin/security?type=BRUTE_FORCE_LOCK" />
	</div>
{/if}
