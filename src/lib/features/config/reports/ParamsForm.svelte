<script lang="ts">
	// Параметры отчёта по описанию шаблона (`paramsFor`): тип сделки, воронка, число, дата, списки значений.
	// Вузы, направления, продукты и сотрудники ищутся на сервере и подгружаются страницами только при открытии списка.
	import { untrack } from 'svelte';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import CheckField from '$lib/ui/fields/CheckField.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import RemoteMultiPick from '$lib/ui/fields/RemoteMultiPick.svelte';
	import RemotePick from '$lib/ui/fields/RemotePick.svelte';
	import type { RemoteItem } from '$lib/ui/fields/remote-list.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { DEAL_TYPES, DEAL_TYPE_LABELS } from '../workflows/graph';
	import { isDisabled, toList, type ReportParamDef } from './params';
	import { directionResolve, directionSearch, orgResolve, orgSearch, ownerResolve, ownerSearch, OWNERS_LIMIT, productResolve, productSearch } from './pickers';

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
	}

	let { defs, values = $bindable({}), errors = {}, workflows = [] }: Props = $props();

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
	{#if def.kind === 'deal_type'}
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
	{:else if def.kind === 'product'}
		<RemotePick
			label={def.label}
			required={def.required}
			placeholder="Начните вводить"
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
	{:else if def.kind === 'organization_multi'}
		<RemoteMultiPick label={def.label} hint={def.hint} value={toList(values[def.key])} search={orgSearch} resolve={orgResolve} emptyText="Вузов не найдено" error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else if def.kind === 'direction_multi'}
		<RemoteMultiPick label={def.label} hint={def.hint} value={toList(values[def.key])} search={directionSearch} resolve={directionResolve} emptyText="Направлений не найдено" error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else if def.kind === 'product_multi'}
		<RemoteMultiPick label={def.label} hint={def.hint} value={toList(values[def.key])} search={productSearch} resolve={productResolve} emptyText="Продуктов не найдено" error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else if def.kind === 'owner_multi'}
		<RemoteMultiPick
			label={def.label}
			hint={def.hint}
			value={toList(values[def.key])}
			search={ownerSearch}
			resolve={ownerResolve}
			emptyText="Сотрудников не найдено"
			note={`Показаны первые ${OWNERS_LIMIT}: уточните запрос`}
			noteAt={OWNERS_LIMIT}
			error={errors[def.key]}
			onChange={(v) => set(def.key, v)}
		/>
	{:else if def.kind === 'enum' || def.kind === 'date_field'}
		<Pick label={def.label} required={def.required} value={String(values[def.key] ?? def.default ?? '')} items={def.options ?? []} hint={def.hint} error={errors[def.key]} onChange={(v) => v && set(def.key, v)} />
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
