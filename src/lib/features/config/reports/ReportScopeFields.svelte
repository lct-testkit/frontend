<script lang="ts">
	// Общий блок отчёта: период (с быстрыми периодами) + вузы + направления + продукты + ответственные. Показывает только те грани,
	// которые читает шаблон: определения приходят из `scopeDefs` (params.ts). Для виджета дашборда быстрый период запоминается
	// пресетом (`period`), а не датами: плитка «Этот месяц» не устаревает на следующий день.
	import { Btn, FormRow, Notice } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import RangeField from '$lib/ui/fields/RangeField.svelte';
	import RemoteMultiPick from '$lib/ui/fields/RemoteMultiPick.svelte';
	import type { RemoteItem } from '$lib/ui/fields/remote-list.svelte';
	import { toList, type ReportParamDef } from './params';
	import { PERIOD_PRESETS, PERIOD_PRESET_LABELS, periodFor, presetOf, type PeriodPreset } from './period';
	import { directionResolve, directionSearch, orgResolve, orgSearch, ownerResolve, ownerSearch, OWNERS_LIMIT, productResolve, productSearch } from './pickers';

	interface Props {
		/** поля общего блока шаблона (`group: 'scope'`) */
		defs: readonly ReportParamDef[];
		values: Record<string, unknown>;
		errors?: Record<string, string>;
		/** виджет дашборда: быстрый период хранится пресетом */
		widget?: boolean;
		period?: PeriodPreset;
	}

	let { defs, values = $bindable({}), errors = {}, widget = false, period = $bindable() }: Props = $props();

	const def = (key: string) => defs.find((d) => d.key === key);
	const dateFieldDef = $derived(def('date_field'));
	const fromDef = $derived(def('date_from'));
	const periodTitle = $derived((fromDef?.label ?? 'Период').replace(/ с$/, ''));
	const today = new Date();

	const set = (patch: Record<string, unknown>) => (values = { ...values, ...patch });

	// пресет виджета важнее дат: даты считаются при запуске
	const shown = $derived(widget && period ? (periodFor(period, today) ?? { date_from: undefined, date_to: undefined }) : { date_from: values.date_from as string | undefined, date_to: values.date_to as string | undefined });
	const activePreset = $derived(widget && period ? period : presetOf(shown.date_from, shown.date_to, today));

	function applyPreset(preset: PeriodPreset) {
		const range = periodFor(preset, today);
		set({ date_from: range?.date_from, date_to: range?.date_to });
		if (widget) period = preset === 'all' ? undefined : preset;
	}
	function setRange(from: string, to: string) {
		set({ date_from: from || undefined, date_to: to || undefined });
		if (widget) period = undefined;
	}

	const isSet = (key: string) => toList(values[key]).length > 0 || (typeof values[key] === 'string' && values[key] !== '');
	const filled = $derived(
		(shown.date_from || shown.date_to ? 1 : 0) + ['organization_ids', 'direction_ids', 'product_ids', 'owner_ids'].filter((k) => defs.some((d) => d.key === k) && isSet(k)).length
	);
	function reset() {
		set({ date_from: undefined, date_to: undefined, date_field: undefined, organization_ids: undefined, direction_ids: undefined, product_ids: undefined, owner_ids: undefined });
		if (widget) period = undefined;
	}

	// у продукта есть направление: если выбраны и направления, и продукты, продукт чужого направления в отчёт не попадёт (фильтры сочетаются по «И»)
	let productKnown = $state<ReadonlyMap<string, RemoteItem>>();
	const strayProducts = $derived.by(() => {
		const dirs = toList(values.direction_ids);
		if (!dirs.length) return [];
		return toList(values.product_ids).flatMap((id) => {
			const item = productKnown?.get(id);
			if (!item) return [];
			const dir = item.direction_id as string | null | undefined;
			return dir && dirs.includes(dir) ? [] : [item.value];
		});
	});

	const facets = $derived(['organization_ids', 'direction_ids', 'product_ids', 'owner_ids'].filter((k) => defs.some((d) => d.key === k)));
	// последнее поле в нечётном ряду занимает всю ширину
	const wide = (key: string) => facets.length % 2 === 1 && facets[facets.length - 1] === key;
	const cls = (key: string) => (wide(key) ? 'col-span-2 max-md:col-span-1' : '');
</script>

<div class="flex flex-col gap-4">
	{#if dateFieldDef}
		<Pick label={dateFieldDef.label} value={String(values.date_field ?? dateFieldDef.default ?? '')} items={dateFieldDef.options ?? []} onChange={(v) => v && set({ date_field: v })} />
	{/if}
	{#if fromDef}
		<div class="flex flex-col gap-2">
			<RangeField label={periodTitle} from={shown.date_from ?? ''} to={shown.date_to ?? ''} onChange={setRange} />
			{#if errors.date_to}<p class="t-desc-l text-danger" role="alert">{errors.date_to}</p>{/if}
			<div class="flex flex-wrap gap-1.5" role="group" aria-label="Быстрый выбор периода">
				{#each PERIOD_PRESETS as preset (preset)}
					<Btn
						label={PERIOD_PRESET_LABELS[preset]}
						size="s"
						variant={activePreset === preset ? 'secondary' : 'ghost'}
						colorScheme={activePreset === preset ? 'accent' : 'neutral'}
						aria-pressed={activePreset === preset}
						onclick={() => applyPreset(preset)}
					/>
				{/each}
			</div>
		</div>
	{/if}
	{#if facets.length}
		<FormRow>
			{#if def('organization_ids')}
				<RemoteMultiPick class={cls('organization_ids')} label={def('organization_ids')?.label} value={toList(values.organization_ids)} search={orgSearch} resolve={orgResolve} emptyText="Вузов не найдено" onChange={(v) => set({ organization_ids: v })} />
			{/if}
			{#if def('direction_ids')}
				<RemoteMultiPick class={cls('direction_ids')} label={def('direction_ids')?.label} value={toList(values.direction_ids)} search={directionSearch} resolve={directionResolve} emptyText="Направлений не найдено" onChange={(v) => set({ direction_ids: v })} />
			{/if}
			{#if def('product_ids')}
				<RemoteMultiPick
					class={cls('product_ids')}
					label={def('product_ids')?.label}
					value={toList(values.product_ids)}
					search={productSearch}
					resolve={productResolve}
					emptyText="Продуктов не найдено"
					onKnown={(m) => (productKnown = m)}
					onChange={(v) => set({ product_ids: v })}
				/>
			{/if}
			{#if def('owner_ids')}
				<RemoteMultiPick
					class={cls('owner_ids')}
					label={def('owner_ids')?.label}
					value={toList(values.owner_ids)}
					search={ownerSearch}
					resolve={ownerResolve}
					emptyText="Сотрудников не найдено"
					note={`Показаны первые ${OWNERS_LIMIT}: уточните запрос`}
					noteAt={OWNERS_LIMIT}
					onChange={(v) => set({ owner_ids: v })}
				/>
			{/if}
		</FormRow>
	{/if}
	{#if strayProducts.length}
		<Notice tone="warning">
			Продукт «{strayProducts[0]}»{strayProducts.length > 1 ? ` и ещё ${strayProducts.length - 1}` : ''} не входит в выбранные направления — в отчёт он не попадёт
		</Notice>
	{/if}
	{#if fromDef || facets.length}
		<div class="flex min-h-9 items-center justify-between gap-3">
			<span class="t-desc-l text-muted">{filled ? `Фильтров: ${filled}.` : 'Фильтров нет.'} Пустое поле — без ограничения.</span>
			{#if filled}<Btn label="Сбросить" size="s" variant="ghost" colorScheme="neutral" onclick={reset} />{/if}
		</div>
	{/if}
</div>
