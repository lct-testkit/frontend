<script lang="ts">
	// Поля организации для создания и правки. ИНН/КПП/ОГРН проверяются сразу по контрольной сумме (как на бэкенде), затем — сервером.
	// Поля из реестра помечены «из ЕГРЮЛ», исправленные руками — «изменено вручную». Контакты ИП приходят маскированными.
	import { onMount } from 'svelte';
	import { PasswordShow } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { IconBtn, UserPicker } from '$lib/ui';
	import { validateInn, validateKpp, validateOgrnAny } from '../requisites/validators';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { regions } from '../shared/refs.svelte';
	import { ORG_TYPE_LABELS } from '../shared/labels';
	import type { Organization } from '../types';
	import { REGISTRY_FIELDS, type OrgFormValues } from './orgUtils';

	interface Props {
		values: OrgFormValues;
		errors?: Record<string, string>;
		/** карточка при правке: нужна для пометок «из ЕГРЮЛ» и масок ИП */
		org?: Organization | null;
		innReadonly?: boolean;
		canOwner?: boolean;
		disabled?: boolean;
		onReveal?: () => void;
		onEnter?: () => void;
	}

	let { values = $bindable(), errors = {}, org = null, innReadonly = false, canOwner = false, disabled = false, onReveal, onEnter }: Props = $props();

	onMount(() => void regions.ensure().catch(() => {}));

	const typeItems = Object.entries(ORG_TYPE_LABELS).map(([key, value]) => ({ key, value }));
	const regionItems = $derived((regions.value ?? []).map((r) => ({ key: r.id, value: r.name, hint: r.federal_district ?? undefined })));

	let inline = $state<Record<string, string>>({});
	const err = (key: string): string | undefined => errors[key] || inline[key] || undefined;

	const origin = (key: string): string | undefined => {
		if (!org?.verified_source || !(REGISTRY_FIELDS as readonly string[]).includes(key)) return undefined;
		return org.manual_overrides.includes(key) ? 'изменено вручную' : 'из ЕГРЮЛ';
	};

	async function verify(kind: 'inn' | 'kpp' | 'ogrn', value: string) {
		const v = value.trim();
		if (!v) {
			inline[kind] = '';
			return;
		}
		const local = kind === 'inn' ? validateInn(v) : kind === 'kpp' ? validateKpp(v) : validateOgrnAny(v);
		if (!local.ok) {
			inline[kind] = local.reason ?? 'Неверное значение';
			return;
		}
		inline[kind] = '';
		try {
			const res = await unwrap(api.POST('/api/org-lookup/validate', { body: { kind: kind === 'ogrn' && v.length === 15 ? 'ogrnip' : kind, value: v } }));
			if (!res.ok) inline[kind] = res.reason ?? 'Неверное значение';
		} catch {
			// сервер недоступен — остаётся локальная проверка
		}
	}

	const phoneMasked = $derived(values.main_phone.includes('*'));
	const emailMasked = $derived(values.main_email.includes('*'));
	const orgTypeIp = $derived(values.org_type === 'individual_entrepreneur');
</script>

<div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
	<div class="col-span-2 max-md:col-span-1">
		<TextField label="Полное название" value={values.name} error={err('name')} hint={origin('name')} {disabled} onInput={(v) => (values.name = v)} onEnter={onEnter} />
	</div>
	<TextField label="Краткое название" value={values.short_name} hint={origin('short_name')} {disabled} onInput={(v) => (values.short_name = v)} onEnter={onEnter} />
	<Pick label="Тип" items={typeItems} value={values.org_type} {disabled} onChange={(v) => v && (values.org_type = v)} />
	<TextField label="ИНН" value={values.inn} error={err('inn')} readonly={innReadonly} disabled={disabled} inputmode="numeric" maxlength={12} onInput={(v) => (values.inn = v)} onBlur={() => !innReadonly && verify('inn', values.inn)} onEnter={onEnter} />
	<TextField label="КПП" value={values.kpp} error={err('kpp')} hint={origin('kpp')} {disabled} inputmode="numeric" maxlength={9} onInput={(v) => (values.kpp = v)} onBlur={() => verify('kpp', values.kpp)} onEnter={onEnter} />
	<TextField label={orgTypeIp ? 'ОГРНИП' : 'ОГРН'} value={values.ogrn} error={err('ogrn')} hint={origin('ogrn')} {disabled} inputmode="numeric" maxlength={15} onInput={(v) => (values.ogrn = v)} onBlur={() => verify('ogrn', values.ogrn)} onEnter={onEnter} />
	<Pick label="Регион" items={regionItems} search clearable value={values.region_id} {disabled} placeholder="Не выбран" onChange={(v) => (values.region_id = v)} />
	<div class="col-span-2 max-md:col-span-1">
		<AreaField label="Юридический адрес" rows={2} maxRows={4} value={values.legal_address} hint={origin('legal_address')} {disabled} onInput={(v) => (values.legal_address = v)} />
	</div>
	<div class="col-span-2 max-md:col-span-1">
		<TextField label="Фактический адрес" value={values.actual_address} {disabled} onInput={(v) => (values.actual_address = v)} onEnter={onEnter} />
	</div>
	<TextField label="Сайт" value={values.website} error={err('website')} inputmode="url" {disabled} onInput={(v) => (values.website = v)} onEnter={onEnter} />
	<NumberField integer label="Студентов" value={values.students_count} {disabled} onChange={(v) => (values.students_count = v)} onEnter={onEnter} />
	<div class="flex items-start gap-1">
		<TextField class="min-w-0 flex-1" label="Телефон" value={values.main_phone} error={err('main_phone')} readonly={phoneMasked} inputmode="tel" {disabled} onInput={(v) => (values.main_phone = v)} onEnter={onEnter} />
		{#if phoneMasked && onReveal}<IconBtn icon={PasswordShow} label="Показать контакты" class="mt-1" onclick={onReveal} />{/if}
	</div>
	<div class="flex items-start gap-1">
		<TextField class="min-w-0 flex-1" label="E-mail" value={values.main_email} error={err('main_email')} readonly={emailMasked} inputmode="email" {disabled} onInput={(v) => (values.main_email = v)} onEnter={onEnter} />
		{#if emailMasked && onReveal && !phoneMasked}<IconBtn icon={PasswordShow} label="Показать контакты" class="mt-1" onclick={onReveal} />{/if}
	</div>
	{#if canOwner}
		<div class="col-span-2 max-md:col-span-1">
			<UserPicker label="Ответственный" roles={['KAM', 'HEAD']} value={values.owner_id} {disabled} onChange={(id) => (values.owner_id = id)} />
		</div>
	{/if}
</div>
