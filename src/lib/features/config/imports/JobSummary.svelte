<script lang="ts">
	// Итог проверки / импорта тремя плитками: без замечаний · с предупреждениями · с ошибками (+ всего строк).
	import { formatNumber } from '$lib/utils/format';
	import type { ImportJob } from '../types';

	interface Props {
		job: Pick<ImportJob, 'total_rows' | 'ok_rows' | 'warn_rows' | 'error_rows'>;
		/** «Применено»: подписи для итога после применения */
		done?: boolean;
	}

	let { job, done = false }: Props = $props();

	const tiles = $derived([
		{ key: 'ok', value: job.ok_rows, label: done ? 'Загружено' : 'Без замечаний', tone: 'bg-success-soft' },
		{ key: 'warn', value: job.warn_rows, label: 'С предупреждениями', tone: 'bg-warning-soft' },
		{ key: 'error', value: job.error_rows, label: done ? 'Пропущено' : 'С ошибками', tone: 'bg-danger-soft' }
	]);
</script>

<div class="flex flex-col gap-2">
	<!-- цветные плитки итога: у rt-ui нет карточки-показателя, а `Tile` из $lib/ui без цветного фона -->
	<div class="grid grid-cols-3 gap-2 max-md:grid-cols-1">
		{#each tiles as t (t.key)}
			<div class={['flex flex-col gap-0.5 rounded-md px-4 py-3 max-md:flex-row max-md:items-baseline max-md:justify-between', t.tone]}>
				<span class="t-h3 tabular-nums">{formatNumber(t.value)}</span>
				<span class="t-desc-l text-muted">{t.label}</span>
			</div>
		{/each}
	</div>
	<p class="t-desc-l text-muted">Всего строк в файле: {formatNumber(job.total_rows)}</p>
</div>
