<script lang="ts">
	// Выбор колонок отчёта: галочки по каждой колонке каталога и порядок «выше / ниже» (доступно с клавиатуры и на телефоне, перетаскивание не нужно).
	// Блок свёрнут, пока выбор совпадает с набором по умолчанию.
	import { ArrowDown, ArrowUp } from '@lct-testkit/rt-ui/icons';
	import { Btn, FormSection, IconBtn } from '$lib/ui';
	import CheckField from '$lib/ui/fields/CheckField.svelte';
	import { allColumns, cleanSelection, columnsAsInSpec, defaultColumns, listOrder, moveColumn, sameColumns, toggleColumn } from './columns';
	import type { ReportParamOption } from './params';

	interface Props {
		options: readonly ReportParamOption[];
		/** выбранные ключи по порядку; `undefined` — набор по умолчанию */
		value?: string[];
		/** колонки «как в ТЗ» (кнопка не показывается, если не заданы) */
		tz?: readonly string[];
		/** не больше стольких (табличный виджет показывает первые 5) */
		max?: number;
		error?: string;
		onChange: (value: string[] | undefined) => void;
	}

	let { options, value, tz, max, error, onChange }: Props = $props();

	const defaults = $derived(defaultColumns(options));
	const selected = $derived(value === undefined ? (max ? defaults.slice(0, max) : defaults) : cleanSelection(value, options));
	const rows = $derived(listOrder(selected, options));
	const changed = $derived(value !== undefined && !sameColumns(selected, max ? defaults.slice(0, max) : defaults));
	const summary = $derived(`${selected.length} из ${options.length}`);
	const tzSet = $derived(tz ? columnsAsInSpec(tz, options) : []);

	const set = (next: string[]) => onChange(next);
</script>

<FormSection title={`Колонки: ${summary}`} collapsible open={changed || Boolean(error)}>
	<div class="flex flex-col gap-3">
		<div class="flex flex-wrap gap-1.5">
			{#if tzSet.length}<Btn label="Как в ТЗ" size="s" variant="outline" colorScheme="neutral" onclick={() => set(tzSet)} />{/if}
			<Btn label="Все" size="s" variant="outline" colorScheme="neutral" onclick={() => set(allColumns(options, max))} />
			<Btn label="По умолчанию" size="s" variant="outline" colorScheme="neutral" onclick={() => onChange(undefined)} />
		</div>
		{#if max}<p class="t-desc-l text-muted">В виджете показываются первые {max}.</p>{/if}
		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			{#each rows as option (option.key)}
				{@const on = selected.includes(option.key)}
				{@const at = selected.indexOf(option.key)}
				<li class="flex min-h-9 items-center justify-between gap-2">
					<CheckField label={option.value} checked={on} disabled={!on && max !== undefined && selected.length >= max} onChange={(v) => set(toggleColumn(selected, option.key, v, max))} />
					{#if on}
						<span class="flex flex-none items-center gap-0.5">
							<IconBtn icon={ArrowUp} label={`Выше: ${option.value}`} size="s" disabled={at === 0} onclick={() => set(moveColumn(selected, option.key, -1))} />
							<IconBtn icon={ArrowDown} label={`Ниже: ${option.value}`} size="s" disabled={at === selected.length - 1} onclick={() => set(moveColumn(selected, option.key, 1))} />
						</span>
					{/if}
				</li>
			{/each}
		</ul>
		{#if error}<p class="t-desc-l text-danger" role="alert">{error}</p>{/if}
	</div>
</FormSection>
