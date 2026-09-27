<script lang="ts">
	// Параметры отчёта по описанию шаблона (`paramsFor`): тип сделки, воронка, число (месяцев / строк),
	// дата, множественный выбор вуза/направления/продукта/ответственного (реестр сделок).
	import { onMount } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { DEAL_TYPES, DEAL_TYPE_LABELS } from '../workflows/graph';
	import type { ReportParamDef } from './params';

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

	// Курсы для параметра «Курс» подгружаются, только если у шаблона такой параметр есть.
	let products = $state<{ key: string; value: string }[]>([]);
	// Вузы, направления, ответственные — фильтры реестра сделок (deal_register); та же схема:
	// один запрос при монтировании, только если шаблон реально просит такой параметр.
	let organizations = $state<{ key: string; value: string }[]>([]);
	let directions = $state<{ key: string; value: string }[]>([]);
	let owners = $state<{ key: string; value: string }[]>([]);
	onMount(async () => {
		if (defs.some((d) => d.kind === 'product' || d.kind === 'product_multi')) {
			try {
				const res = await unwrap(api.GET('/api/products', { params: { query: { is_active: true, limit: 100 } } }));
				products = res.items.map((p) => ({ key: p.id, value: p.name }));
			} catch {
				products = [];
			}
		}
		if (defs.some((d) => d.kind === 'organization_multi')) {
			try {
				const res = await unwrap(api.GET('/api/organizations', { params: { query: { limit: 100 } } }));
				organizations = res.items.map((o) => ({ key: o.id, value: o.short_name || o.name }));
			} catch {
				organizations = [];
			}
		}
		if (defs.some((d) => d.kind === 'direction_multi')) {
			try {
				const res = await unwrap(api.GET('/api/directions', { params: { query: { all: true } } }));
				directions = res.items.map((d) => ({ key: d.id, value: d.name }));
			} catch {
				directions = [];
			}
		}
		if (defs.some((d) => d.kind === 'owner_multi')) {
			try {
				owners = (await people.search('', undefined, 100)).map((p) => ({ key: p.id, value: p.display_name || p.full_name }));
			} catch {
				owners = [];
			}
		}
	});

	const set = (key: string, value: unknown) => (values = { ...values, [key]: value });
	const dealType = $derived(String(values.deal_type ?? defs.find((d) => d.key === 'deal_type')?.default ?? ''));
</script>

{#each defs as def (def.key)}
	{#if def.kind === 'deal_type'}
		<Pick
			label={def.label}
			required={def.required}
			value={String(values[def.key] ?? def.default ?? 'b2b')}
			items={DEAL_TYPES.map((t) => ({ key: t, value: DEAL_TYPE_LABELS[t] }))}
			error={errors[def.key]}
			onChange={(v) => v && set(def.key, v)}
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
		<Pick label={def.label} required={def.required} value={(values[def.key] as string | undefined) ?? null} clearable search hint={def.hint} items={products} emptyText="Продуктов нет" error={errors[def.key]} onChange={(v) => set(def.key, v ?? undefined)} />
	{:else if def.kind === 'date'}
		<DateField label={def.label} required={def.required} value={(values[def.key] as string | undefined) ?? null} error={errors[def.key]} onChange={(v) => set(def.key, v ?? undefined)} />
	{:else if def.kind === 'organization_multi'}
		<MultiPick label={def.label} hint={def.hint} value={(values[def.key] as string[] | undefined) ?? []} items={organizations} emptyText="Организаций нет" error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else if def.kind === 'direction_multi'}
		<MultiPick label={def.label} hint={def.hint} value={(values[def.key] as string[] | undefined) ?? []} items={directions} emptyText="Направлений нет" error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else if def.kind === 'product_multi'}
		<MultiPick label={def.label} hint={def.hint} value={(values[def.key] as string[] | undefined) ?? []} items={products} emptyText="Продуктов нет" error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else if def.kind === 'owner_multi'}
		<MultiPick label={def.label} hint={def.hint} value={(values[def.key] as string[] | undefined) ?? []} items={owners} emptyText="Сотрудников нет" error={errors[def.key]} onChange={(v) => set(def.key, v)} />
	{:else}
		<NumberField label={def.label} required={def.required} integer min={def.min} max={def.max} value={typeof values[def.key] === 'number' ? (values[def.key] as number) : null} error={errors[def.key]} onChange={(n) => set(def.key, n ?? undefined)} />
	{/if}
{/each}
