<script lang="ts">
	// Продукт: минимум полей сверху (код, название, направление, формат, цена), остальное — в «Дополнительно».
	import { untrack } from 'svelte';
	import { api, unwrap, idem, ifMatch } from '$lib/api';
	import { toast } from '$lib/ui';
	import { PRODUCT_FORMATS } from '../labels';
	import type { CustomFieldDef, Product } from '../types';
	import { FormDrawer, FormRow, FormSection } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import OrgPicker from '$lib/features/crm/shared/pickers/OrgPicker.svelte';
	import { toFormFailure } from '../shared/form-errors';
	import CustomFieldsInputs from './CustomFieldsInputs.svelte';
	import ProductContacts from './ProductContacts.svelte';
	import { checkCustomValues } from './custom-fields';
	import { directionOptions } from './directions';
	import { directions, ensureDirections } from './directions.svelte';

	interface Props {
		open: boolean;
		item: Product | null;
		onClose: () => void;
		onSaved: (product: Product, created: boolean) => void;
	}

	let { open, item, onClose, onSaved }: Props = $props();

	let code = $state('');
	let name = $state('');
	let directionId = $state<string | null>(null);
	let format = $state<string | null>(null);
	let price = $state<number | null>(null);
	let description = $state('');
	let duration = $state<number | null>(null);
	let currency = $state('RUB');
	let validFrom = $state<string | null>(null);
	let validTo = $state<string | null>(null);
	/** организация-вендор продукта (файл «Вендоры»); пусто — вендор не указан */
	let vendorId = $state<string | null>(null);
	let isActive = $state(true);
	let custom = $state<Record<string, unknown>>({});
	let defs = $state<CustomFieldDef[]>([]);

	let version = $state(0);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	const isNew = $derived(item === null);
	const dirItems = $derived(directionOptions(directions.data ?? []));

	$effect(() => {
		if (!open) return;
		untrack(() => {
			ensureDirections();
			const p = item;
			code = p?.code ?? '';
			name = p?.name ?? '';
			directionId = p?.direction_id ?? null;
			vendorId = p?.vendor_id ?? null;
			format = p?.format ?? null;
			price = p?.base_price != null ? Number(p.base_price) : null;
			description = p?.description ?? '';
			duration = p?.duration_hours ?? null;
			currency = p?.currency ?? 'RUB';
			validFrom = p?.valid_from ?? null;
			validTo = p?.valid_to ?? null;
			isActive = p?.is_active ?? true;
			custom = { ...((p?.custom_fields as Record<string, unknown> | undefined) ?? {}) };
			version = p?.version ?? 0;
			errors = {};
			formError = null;
			conflict = false;
			idemKey = crypto.randomUUID();
			void loadDefs();
		});
	});

	async function loadDefs() {
		try {
			const res = await unwrap(api.GET('/api/custom-field-defs', { params: { query: { entity_type: 'product', is_active: true } } }));
			defs = res.items;
		} catch {
			defs = [];
		}
	}

	function validate(): boolean {
		const next: Record<string, string> = {};
		if (isNew && !code.trim()) next.code = 'Укажите код';
		if (!name.trim()) next.name = 'Укажите название';
		if (price !== null && price < 0) next.base_price = 'Цена не может быть отрицательной';
		if (duration !== null && duration < 0) next.duration_hours = 'Не меньше нуля';
		if (validFrom && validTo && validFrom > validTo) next.valid_to = 'Раньше даты начала';
		if (!/^[A-Za-z]{3}$/.test(currency)) next.currency = 'Три буквы, например RUB';
		Object.assign(next, checkCustomValues(defs, custom));
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function save() {
		formError = null;
		if (!validate()) return;
		saving = true;
		try {
			const body = {
				name: name.trim(),
				description: description.trim() || null,
				direction_id: directionId,
				vendor_id: vendorId,
				duration_hours: duration,
				format: (format as 'online' | 'offline' | 'blended' | null) ?? null,
				base_price: price,
				currency: currency.toUpperCase(),
				valid_from: validFrom,
				valid_to: validTo,
				is_active: isActive,
				custom_fields: custom
			};
			if (item) {
				const saved = await unwrap(api.PATCH('/api/products/{product_id}', { params: { path: { product_id: item.id } }, body, headers: ifMatch(version) }));
				toast.success('Продукт сохранён');
				onSaved(saved, false);
			} else {
				const created = await unwrap(api.POST('/api/products', { body: { ...body, code: code.trim() }, headers: idem(idemKey) }));
				toast.success('Продукт создан');
				onSaved(created, true);
			}
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['code', 'name', 'direction_id', 'vendor_id', 'format', 'base_price', 'currency', 'duration_hours', 'valid_from', 'valid_to']);
			errors = { ...failure.fields };
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	/** После конфликта версий: берём актуальную версию записи, введённое остаётся в форме. */
	async function reloadVersion() {
		if (!item) return;
		try {
			const res = await unwrap(api.GET('/api/products', { params: { query: { code: item.code, limit: 1 } } }));
			const fresh = res.items[0];
			if (fresh) {
				version = fresh.version;
				conflict = false;
				toast.info('Загружена актуальная версия', 'Проверьте поля и сохраните ещё раз');
			}
		} catch (e) {
			toast.error(e);
		}
	}
</script>

<FormDrawer {open} title={isNew ? 'Новый продукт' : name || 'Продукт'} {saving} {formError} {conflict} onSave={save} {onClose} onReload={reloadVersion}>
	{#if isNew}
		<TextField label="Код" required bind:value={code} error={errors.code} maxlength={64} autofocus />
	{:else}
		<TextField label="Код" value={code} readonly hint="Код после создания не меняется" />
	{/if}
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} autofocus={!isNew} />
	<Pick label="Направление" bind:value={directionId} items={dirItems} error={errors.direction_id} clearable search emptyText={directions.loading ? 'Загрузка…' : 'Направлений нет'} />
	<OrgPicker label="Вендор" value={vendorId} error={errors.vendor_id} hint="Компания, чей это продукт" onChange={(id) => (vendorId = id)} />
	<FormRow>
		<Pick label="Формат" bind:value={format} items={PRODUCT_FORMATS.map((f) => ({ key: f.key, value: f.value }))} clearable error={errors.format} />
		<NumberField label="Цена, ₽" bind:value={price} error={errors.base_price} />
	</FormRow>
	<Toggle label="Активен" bind:checked={isActive} />
	{#if item}
		<FormSection title="Ответственные"><ProductContacts productId={item.id} /></FormSection>
	{/if}
	<FormSection collapsible open={!!(description || duration || validFrom || validTo)}>
		<AreaField label="Описание" bind:value={description} />
		<FormRow>
			<NumberField label="Длительность, ч" bind:value={duration} integer error={errors.duration_hours} />
			<TextField label="Валюта" required bind:value={currency} error={errors.currency} maxlength={3} />
		</FormRow>
		<FormRow>
			<DateField label="Действует с" bind:value={validFrom} error={errors.valid_from} />
			<DateField label="Действует по" bind:value={validTo} error={errors.valid_to} />
		</FormRow>
		<CustomFieldsInputs {defs} bind:values={custom} {errors} />
	</FormSection>
</FormDrawer>
