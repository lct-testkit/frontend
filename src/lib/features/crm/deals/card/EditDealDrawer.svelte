<script lang="ts">
	// Правка сделки, поля по смыслу: «Сделка» (название, организация, контакт, источник, обучающиеся), «Стоимость и сроки», «Внутренняя оценка» (приоритет — внутренняя оценка CRM, отдельно от денег), поля воронки. PATCH с If-Match —
	// шлём только изменённое; конфликт версий показывает баннер «Обновить», введённое сохраняется (обновляется только версия).
	import { onMount, untrack } from 'svelte';
	import { ApiError, errorMessage } from '$lib/api';
	import { CheckField, FormDrawer, FormRow, FormSection, toast } from '$lib/ui';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import ContactPicker from '../../shared/pickers/ContactPicker.svelte';
	import OrgPicker from '../../shared/pickers/OrgPicker.svelte';
	import { DEAL_SOURCE_LABELS, PRIORITY_LABELS } from '../../shared/labels';
	import { dealFieldDefs } from '../../shared/refs.svelte';
	import type { CustomFieldDef, Deal } from '../../types';
	import type { DealCardState } from './dealCard.svelte';

	interface Props {
		open: boolean;
		card: DealCardState;
		onClose: () => void;
	}

	let { open, card, onClose }: Props = $props();

	interface Values {
		title: string;
		amount: number | null;
		students: number | null;
		close: string | null;
		priority: string;
		source: string | null;
		org: string | null;
		contact: string | null;
		custom: Record<string, unknown>;
	}

	const read = (d: Deal): Values => ({
		title: d.title,
		amount: d.amount === null || d.amount === undefined ? null : Number(d.amount),
		students: d.students_planned ?? null,
		close: d.expected_close_date ?? null,
		priority: d.priority,
		source: d.source ?? null,
		org: d.organization_id ?? null,
		contact: d.contact_id ?? null,
		custom: { ...d.custom_fields }
	});

	// svelte-ignore state_referenced_locally
	let base = read(card.deal!);
	// svelte-ignore state_referenced_locally
	let v = $state<Values>(read(card.deal!));
	let errors = $state<Record<string, string>>({});
	let banner = $state<string | null>(null);
	let conflict = $state(false);
	let busy = $state(false);

	onMount(() => void dealFieldDefs.ensure().catch(() => {}));

	$effect(() => {
		if (!open) return;
		untrack(() => {
			base = read(card.deal!);
			v = read(card.deal!);
			errors = {};
			banner = null;
			conflict = false;
		});
	});

	const defs = $derived(
		(dealFieldDefs.value ?? []).filter((d) => !d.workflow_id || d.workflow_id === card.deal?.workflow_id).sort((a, b) => a.sort_order - b.sort_order)
	);
	const priorityItems = Object.entries(PRIORITY_LABELS).map(([key, value]) => ({ key, value }));
	const sourceItems = Object.entries(DEAL_SOURCE_LABELS).map(([key, value]) => ({ key, value }));

	function options(def: CustomFieldDef): { key: string; value: string }[] {
		const raw = def.options as Record<string, unknown> | null | undefined;
		const list = (raw?.items ?? raw?.values ?? raw?.options) as unknown;
		if (!Array.isArray(list)) return [];
		return list.map((item) => {
			if (typeof item === 'object' && item !== null) {
				const o = item as { key?: unknown; value?: unknown; label?: unknown };
				const key = String(o.key ?? o.value ?? '');
				return { key, value: String(o.label ?? o.value ?? key) };
			}
			return { key: String(item), value: String(item) };
		});
	}

	const setCustom = (code: string, value: unknown) => (v.custom = { ...v.custom, [code]: value });

	function diff(): Record<string, unknown> {
		const body: Record<string, unknown> = {};
		if (v.title.trim() !== base.title) body.title = v.title.trim();
		if (v.amount !== base.amount) body.amount = v.amount === null ? null : String(v.amount);
		if (v.students !== base.students) body.students_planned = v.students;
		if (v.close !== base.close) body.expected_close_date = v.close;
		if (v.priority !== base.priority) body.priority = v.priority;
		if (v.source !== base.source) body.source = v.source;
		if (v.org !== base.org) body.organization_id = v.org;
		if (v.contact !== base.contact) body.contact_id = v.contact;
		const custom: Record<string, unknown> = {};
		for (const def of defs) {
			const a = base.custom[def.code] ?? null;
			const b = v.custom[def.code] ?? null;
			if (JSON.stringify(a) !== JSON.stringify(b)) custom[def.code] = b === '' ? null : b;
		}
		if (Object.keys(custom).length) body.custom_fields = custom;
		return body;
	}

	async function refresh() {
		if (busy) return;
		busy = true;
		await card.refresh();
		conflict = false;
		banner = null;
		busy = false;
	}

	async function save() {
		if (busy) return;
		if (!v.title.trim()) {
			errors = { title: 'Введите название' };
			return;
		}
		const body = diff();
		if (!Object.keys(body).length) {
			onClose();
			return;
		}
		busy = true;
		banner = null;
		try {
			await card.patch(body);
			toast.success('Сделка сохранена');
			onClose();
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) {
				conflict = true;
				banner = 'Сделка изменена другим пользователем. Обновите данные — введённое сохранится.';
			} else if (e instanceof ApiError && e.isValidation && Object.keys(e.fieldErrors()).length) {
				errors = e.fieldErrors();
			} else {
				banner = errorMessage(e);
			}
		} finally {
			busy = false;
		}
	}
</script>

<FormDrawer
	{open}
	title="Редактирование сделки"
	saving={busy}
	saveTestId="deal-save"
	dirty={open && Object.keys(diff()).length > 0}
	{conflict}
	conflictText={banner ?? undefined}
	reloadLabel="Обновить"
	formError={conflict ? null : banner}
	onSave={save}
	onReload={refresh}
	{onClose}
>
	<FormSection title="Сделка">
		<TextField label="Название" required autofocus value={v.title} error={errors.title} onInput={(x) => ((v.title = x), (errors.title = ''))} />
		{#if card.deal?.deal_type === 'b2b'}
			<OrgPicker required value={v.org} error={errors.organization_id} onChange={(id) => ((v.org = id), (v.contact = null))} />
		{/if}
		<ContactPicker value={v.contact} organizationId={v.org} onChange={(id) => (v.contact = id)} />
		<FormRow>
			<Pick label="Источник" items={sourceItems} clearable value={v.source} placeholder="Не указан" onChange={(x) => (v.source = x)} />
			<NumberField integer label="Обучающихся" value={v.students} onChange={(x) => (v.students = x)} />
		</FormRow>
	</FormSection>

	<FormSection title="Стоимость и сроки" class="mt-2">
		<FormRow>
			<NumberField label="Сумма, ₽" value={v.amount} error={errors.amount} onChange={(x) => (v.amount = x)} />
			<DateField label="Плановая дата закрытия" value={v.close} error={errors.expected_close_date} onChange={(x) => (v.close = x)} />
		</FormRow>
	</FormSection>

	<FormSection title="Внутренняя оценка" class="mt-2">
		<Pick label="Приоритет" items={priorityItems} value={v.priority} onChange={(x) => x && (v.priority = x)} />
	</FormSection>

	{#if defs.length}
		<FormSection title="Дополнительные поля" class="mt-2">
			{#each defs as def (def.id)}
				{@const value = v.custom[def.code]}
				{@const err = errors[`custom_fields.${def.code}`]}
				{#if def.field_type === 'bool'}
					<CheckField label={def.label} required={def.is_required} checked={value === true} onChange={(x) => setCustom(def.code, x)} />
				{:else if def.field_type === 'number'}
					<NumberField label={def.label} required={def.is_required} value={typeof value === 'number' ? value : value ? Number(value) : null} error={err} onChange={(x) => setCustom(def.code, x)} />
				{:else if def.field_type === 'date'}
					<DateField label={def.label} required={def.is_required} value={typeof value === 'string' ? value : null} error={err} onChange={(x) => setCustom(def.code, x)} />
				{:else if def.field_type === 'select' && options(def).length}
					<Pick label={def.label} required={def.is_required} items={options(def)} clearable value={typeof value === 'string' ? value : null} error={err} onChange={(x) => setCustom(def.code, x)} />
				{:else if def.field_type === 'multiselect' && options(def).length}
					<MultiPick label={def.label} required={def.is_required} items={options(def)} value={Array.isArray(value) ? (value as string[]) : []} error={err} onChange={(x) => setCustom(def.code, x)} />
				{:else}
					<TextField label={def.label} required={def.is_required} value={value === null || value === undefined ? '' : String(value)} error={err} onInput={(x) => setCustom(def.code, x)} />
				{/if}
			{/each}
		</FormSection>
	{/if}
</FormDrawer>
