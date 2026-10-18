<script lang="ts">
	// Панель лицензии: создать или изменить договор вуз–вендор–ПО, не уходя со списка. Права, `Idempotency-Key`, `If-Match`, плашка конфликта версий —
	// как у остальных форм (образец — ProductDrawer). ФИО менеджера и ответственные без права `contact:reveal` приходят маской: показываются, но не правятся.
	import { onMount, untrack } from 'svelte';
	import { api, unwrap, idem, ifMatch } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { FormDrawer, FormRow, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '$lib/features/config/shared/form-errors';
	import OrgPicker from '../shared/pickers/OrgPicker.svelte';
	import { TRANSFER_STATUS_LABELS } from '../shared/labels';
	import type { OrganizationLicense } from '../types';
	import { licenseAccess } from './access';
	import { softwareOf } from './licenseCatalog';
	import { softwareCatalog, vendorsOf } from './licenseCatalog.svelte';
	import { getLicense } from './licenseApi';
	import { EMPTY_VALUES, MAX_LEN, TERM_YEARS, isChanged, toCreateBody, toPatchBody, validateLicense, valuesFrom, type LicenseErrors, type LicenseValues } from './licenseForm';
	import SuggestField from './SuggestField.svelte';

	interface Props {
		open: boolean;
		/** null — новая лицензия */
		item: OrganizationLicense | null;
		/** вуз, из карточки которого открыта форма: подставлен и не меняется */
		orgId?: string | null;
		onClose: () => void;
		onSaved: (license: OrganizationLicense, created: boolean) => void;
	}

	let { open, item, orgId = null, onClose, onSaved }: Props = $props();

	let v = $state<LicenseValues>({ ...EMPTY_VALUES });
	let version = $state(0);
	let errors = $state<LicenseErrors>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	const access = $derived(licenseAccess((p) => session.can(p)));
	const canReveal = $derived(session.can('contact:reveal'));
	const isNew = $derived(item === null);
	const readOnly = $derived(isNew ? !access.create : !access.edit);
	const maskedHint = 'Скрыто правами доступа к персональным данным';
	const piiLocked = $derived(!isNew && !canReveal);

	onMount(() => {
		void softwareCatalog.ensure().catch(() => {});
	});

	$effect(() => {
		if (!open) return;
		untrack(() => {
			v = valuesFrom(item, orgId);
			version = item?.version ?? 0;
			errors = {};
			formError = null;
			conflict = false;
			idemKey = crypto.randomUUID();
		});
	});

	const vendorSuggestions = $derived(vendorsOf(softwareCatalog.value));
	const softwareSuggestions = $derived(softwareOf(softwareCatalog.value ?? [], v.vendorId));
	const statusItems = Object.entries(TRANSFER_STATUS_LABELS).map(([key, value]) => ({ key, value }));
	const signedItems = [
		{ key: 'yes', value: 'Подписана' },
		{ key: 'no', value: 'Не подписана' }
	];
	const canSave = $derived(!readOnly && (isNew || (item !== null && isChanged({ ...item, version }, v, canReveal))));

	const KNOWN = ['contract_number', 'organization_id', 'vendor', 'product_name', 'transfer_status', 'license_signed_at', 'license_valid_until', 'license_term_years', 'manager_full_name'] as const;

	async function save() {
		formError = null;
		errors = validateLicense(v, { isNew });
		if (Object.keys(errors).length) return;
		saving = true;
		try {
			if (item) {
				const body = toPatchBody(item, v, canReveal);
				const saved = await unwrap(api.PATCH('/api/organization-licenses/{license_id}', { params: { path: { license_id: item.id } }, body, headers: ifMatch(version) }));
				toast.success('Лицензия сохранена');
				onSaved(saved, false);
			} else {
				const created = await unwrap(api.POST('/api/organization-licenses', { body: toCreateBody(v), headers: idem(idemKey) }));
				toast.success('Лицензия создана');
				onSaved(created, true);
			}
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, KNOWN);
			errors = failure.fields as LicenseErrors;
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	/** После конфликта версий берём актуальную версию записи; введённое остаётся в форме. */
	async function reloadVersion() {
		if (!item) return;
		try {
			const fresh = await getLicense(item.id);
			if (!fresh) {
				toast.error('Лицензия удалена другим пользователем');
				onClose();
				return;
			}
			version = fresh.version;
			conflict = false;
			toast.info('Загружена актуальная версия', 'Проверьте поля и сохраните ещё раз');
		} catch (e) {
			toast.error(e);
		}
	}
</script>

<FormDrawer {open} title={isNew ? 'Новая лицензия' : `${item?.vendor ?? ''} · ${item?.product_name ?? ''}`} width={520} {saving} {formError} {conflict} {canSave} showSave={!readOnly} cancelLabel={readOnly ? 'Закрыть' : 'Отмена'} onSave={save} {onClose} onReload={reloadVersion}>
	<OrgPicker label="Вуз" required value={v.orgId} error={errors.organization_id} disabled={!isNew || !!orgId || readOnly} onChange={(id) => (v.orgId = id)} />
	<SuggestField label="Вендор" required value={v.vendor} pickedId={v.vendorId} items={vendorSuggestions} error={errors.vendor} maxlength={MAX_LEN.vendor} disabled={readOnly} onChange={(text, id) => ((v.vendor = text), (v.vendorId = id))} />
	<SuggestField label="ПО" required value={v.product} pickedId={v.productId} items={softwareSuggestions} error={errors.product_name} hint="Программное обеспечение по договору" maxlength={MAX_LEN.product} disabled={readOnly} onChange={(text, id) => ((v.product = text), (v.productId = id))} />
	<TextField label="Номер договора" bind:value={v.contract} error={errors.contract_number} maxlength={MAX_LEN.contract} hint="Можно оставить пустым" disabled={readOnly} />
	<Pick label="Статус по передаче" items={statusItems} clearable value={v.status} placeholder="Не указан" disabled={readOnly} onChange={(s) => (v.status = s)} />
	<FormRow>
		<Pick label="Подписание лицензии" items={signedItems} clearable value={v.signedState || null} placeholder="Не указано" disabled={readOnly} onChange={(s) => (v.signedState = (s ?? '') as LicenseValues['signedState'])} />
		<DateField label="Дата подписания" bind:value={v.signedAt} error={errors.license_signed_at} disabled={readOnly} />
	</FormRow>
	<Toggle label="Бессрочная" bind:checked={v.perpetual} disabled={readOnly} />
	{#if !v.perpetual}
		<FormRow>
			<DateField label="Действует до" bind:value={v.validUntil} error={errors.license_valid_until} hint="Год — в колонку «Срок»" disabled={readOnly} />
			<NumberField label="Срок, лет" bind:value={v.termYears} integer min={TERM_YEARS.min} max={TERM_YEARS.max} error={errors.license_term_years} hint="Если даты окончания нет" disabled={readOnly} />
		</FormRow>
	{:else if errors.license_valid_until}
		<p class="m-0 text-sm text-danger">{errors.license_valid_until}</p>
	{/if}
	<TextField label="ФИО менеджера" bind:value={v.manager} error={errors.manager_full_name} maxlength={MAX_LEN.manager} disabled={readOnly || piiLocked} hint={piiLocked ? maskedHint : undefined} />
	<AreaField label="Ответственные от вуза" bind:value={v.responsible} disabled={readOnly || piiLocked} hint={piiLocked ? maskedHint : undefined} />
	<AreaField label="Комментарий" bind:value={v.comment} disabled={readOnly} />
</FormDrawer>
