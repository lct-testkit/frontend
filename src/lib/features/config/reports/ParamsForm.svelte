<script lang="ts">
	// Параметры отчёта по описанию шаблона (`paramsFor`): тип сделки, воронка, число, дата, списки значений.
	// Вузы, направления, продукты и сотрудники ищутся на сервере и подгружаются страницами только при открытии списка.
	import { untrack } from 'svelte';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import CheckField from '$lib/ui/fields/CheckField.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import RemotePick from '$lib/ui/fields/RemotePick.svelte';
	import type { RemoteItem } from '$lib/ui/fields/remote-list.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { DEAL_TYPES, DEAL_TYPE_LABELS } from '../workflows/graph';
	import { isDisabled, toList, type ReportParamDef } from './params';
	import type { PeriodPreset } from './period';
	import ColumnsPicker from './ColumnsPicker.svelte';
	import ReportScopeFields from './ReportScopeFields.svelte';
	import { productResolve, productSearch } from './pickers';

	export interface WorkflowOption {
		id: string;
		name: string;
		deal_type: string;
	}

	interface Props {
		defs: readonly ReportParamDef[];
		values: Record<string, unknown>;
		errors?: Record<string, string>;
		workflows?: readonly WorkflowOption[];
		/** список воронок не загрузился: под полем «Воронка» — «Повторить» */
		workflowsFailed?: boolean;
		onRetryWorkflows?: () => void;
		/** виджет дашборда: быстрый период хранится пресетом */
		widget?: boolean;
		period?: PeriodPreset;
		/** не больше стольких колонок (табличный виджет) */
		maxColumns?: number;
	}

	let { defs, values = $bindable({}), errors = {}, workflows = [], workflowsFailed = false, onRetryWorkflows, widget = false, period = $bindable(), maxColumns }: Props = $props();

	// поля общего блока рисует один компонент — на месте первого из них
	const scopeDefs = $derived(defs.filter((d) => d.group === 'scope'));

	const set = (key: string, value: unknown) => (values = { ...values, [key]: value });
	// смена типа сделки: воронка другого типа на сервер не уйдёт
	function setDealType(next: string) {
		const wf = values.workflow_id as string | undefined;
		const keep = wf && workflows.find((w) => w.id === wf)?.deal_type === next;
		values = { ...values, deal_type: next, workflow_id: keep ? wf : undefined };
	}
	const hintOf = (def: ReportParamDef) => (isDisabled(def, values) ? def.disabledHint : def.hint);
	const dealType = $derived(String(values.deal_type ?? defs.find((d) => d.key === 'deal_type')?.default ?? ''));

	// «Курс» (одиночный выбор продукта): название сохранённого значения подтягивается один раз
	let course = $state<RemoteItem | null>(null);
	$effect(() => {
		const id = values.product_id;
		if (typeof id !== 'string' || !id || course?.key === id) return;
		untrack(() =>
			productResolve([id])
				.then((found) => (course = found[0] ?? null))
				.catch(() => {})
		);
	});
	const courseSearch = async (q: string): Promise<RemoteItem[]> => (await productSearch(q, null)).items;
</script>

{#each defs as def (def.key)}
	{#if def.group === 'scope'}
		{#if def.key === scopeDefs[0]?.key}<ReportScopeFields defs={scopeDefs} bind:values {errors} {widget} bind:period monthsBased={defs.some((d) => d.key === 'months')} />{/if}
	{:else if def.kind === 'deal_type'}
		<Pick
			label={def.label}
			required={def.required}
			value={String(values[def.key] ?? def.default ?? 'b2b')}
			items={DEAL_TYPES.map((t) => ({ key: t, value: DEAL_TYPE_LABELS[t] }))}
			error={errors[def.key]}
			onChange={(v) => v && setDealType(v)}
		/>
	{:else if def.kind === 'workflow'}
		<Pick
			label={def.label}
			required={def.required}
			value={(values[def.key] as string | undefined) ?? null}
			clearable
			search
			hint={def.hint}
			items={workflows.filter((w) => !dealType || w.deal_type === dealType).map((w) => ({ key: w.id, value: w.name }))}
			error={errors[def.key]}
			onChange={(v) => set(def.key, v ?? undefined)}
		/>
		{#if workflowsFailed}
			<div class="flex items-center gap-2">
				<span class="t-desc-l text-danger">Не удалось загрузить воронки</span>
				<button type="button" class="t-body-s-strong rounded-md py-1 text-accent hover:text-accent-hover pointer-coarse:min-h-11" onclick={() => onRetryWorkflows?.()}>Повторить</button>
			</div>
		{/if}
	{:else if def.kind === 'product'}
		<RemotePick
			label={def.label}
			required={def.required}
			placeholder="Начните вводить"
			lazy
			value={(values[def.key] as string | undefined) ?? null}
			selected={course}
			search={courseSearch}
			hint={def.hint}
			emptyText="Продуктов не найдено"
			error={errors[def.key]}
			onChange={(id, item) => {
				course = item ?? null;
				set(def.key, id ?? undefined);
			}}
		/>
	{:else if def.kind === 'date'}
		<DateField label={def.label} required={def.required} hint={def.hint} value={(values[def.key] as string | undefined) ?? null} error={errors[def.key]} onChange={(v) => set(def.key, v ?? undefined)} />
	{:else if def.kind === 'enum' || def.kind === 'date_field'}
		<!-- значение по умолчанию и «обязательное» — выбор всегда задан; иначе список можно очистить («Любой») -->
		{@const optional = def.kind === 'enum' && !def.required && def.default === undefined}
		<Pick
			label={def.label}
			required={def.required}
			value={optional ? ((values[def.key] as string | undefined) ?? null) : String(values[def.key] ?? def.default ?? '')}
			items={def.options ?? []}
			hint={def.hint}
			error={errors[def.key]}
			clearable={optional}
			placeholder={optional ? 'Любой' : undefined}
			onChange={(v) => (v ? set(def.key, v) : optional && set(def.key, undefined))}
		/>
	{:else if def.kind === 'enum_multi'}
		<MultiPick label={def.label} hint={def.hint} search={false} value={toList(values[def.key])} items={def.options ?? []} error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else if def.kind === 'text_list'}
		<TextField
			label={def.label}
			hint={def.hint}
			maxlength={500}
			value={Array.isArray(values[def.key]) ? (values[def.key] as string[]).join(', ') : String(values[def.key] ?? '')}
			error={errors[def.key]}
			onInput={(v) => set(def.key, v)}
		/>
	{:else if def.kind === 'columns'}
		<ColumnsPicker options={def.options ?? []} value={Array.isArray(values[def.key]) ? (values[def.key] as string[]) : undefined} tz={def.tz} max={maxColumns} error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else if def.kind === 'bool'}
		<CheckField label={def.label} hint={def.hint} checked={values[def.key] === true} onChange={(v) => set(def.key, v || undefined)} />
	{:else}
		<NumberField
			label={def.label}
			required={def.required}
			hint={hintOf(def)}
			disabled={isDisabled(def, values)}
			integer
			min={def.min}
			max={def.max}
			value={typeof values[def.key] === 'number' ? (values[def.key] as number) : null}
			error={errors[def.key]}
			onChange={(n) => set(def.key, n ?? undefined)}
		/>
	{/if}
{/each}
