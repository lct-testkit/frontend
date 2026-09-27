<script lang="ts">
	// Поля формы по определениям пользовательских полей (`/api/custom-field-defs`): тип поля → нужный контрол.
	// Значения — объект `{ код: значение }` (`bind:values`), как их хранит бэкенд в `custom_fields`.
	import type { CustomFieldDef } from '../types';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { choicesOf } from './custom-fields';

	interface Props {
		defs: readonly CustomFieldDef[];
		values: Record<string, unknown>;
		errors?: Record<string, string>;
	}

	let { defs, values = $bindable({}), errors = {} }: Props = $props();

	const shown = $derived(defs.filter((d) => d.field_type !== 'file').sort((a, b) => a.sort_order - b.sort_order));
	const set = (code: string, value: unknown) => (values = { ...values, [code]: value });
</script>

{#each shown as def (def.id)}
	{#if def.field_type === 'number'}
		<NumberField label={def.label} required={def.is_required} value={typeof values[def.code] === 'number' ? (values[def.code] as number) : null} error={errors[def.code]} onChange={(v) => set(def.code, v)} />
	{:else if def.field_type === 'date'}
		<DateField label={def.label} required={def.is_required} value={(values[def.code] as string | null) ?? null} error={errors[def.code]} onChange={(v) => set(def.code, v)} />
	{:else if def.field_type === 'bool'}
		<Toggle label={def.label} checked={values[def.code] === true} onChange={(v) => set(def.code, v)} />
	{:else if def.field_type === 'select'}
		<Pick label={def.label} required={def.is_required} clearable items={choicesOf(def).map((c) => ({ key: c, value: c }))} value={(values[def.code] as string | null) ?? null} error={errors[def.code]} onChange={(v) => set(def.code, v)} />
	{:else if def.field_type === 'multiselect'}
		<MultiPick label={def.label} required={def.is_required} items={choicesOf(def).map((c) => ({ key: c, value: c }))} value={Array.isArray(values[def.code]) ? (values[def.code] as string[]) : []} error={errors[def.code]} onChange={(v) => set(def.code, v)} />
	{:else}
		<TextField label={def.label} required={def.is_required} value={(values[def.code] as string | undefined) ?? ''} error={errors[def.code]} onInput={(v) => set(def.code, v || null)} />
	{/if}
{/each}
