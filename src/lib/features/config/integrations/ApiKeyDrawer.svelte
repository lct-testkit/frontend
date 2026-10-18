<script lang="ts">
	// Новый API-ключ: название, служебная учётка роли «Интеграция», срок. Сам ключ приходит в `onCreated` и показывается снаружи один раз.
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { FormDrawer, Notice } from '$lib/ui';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { toFormFailure } from '../shared/form-errors';
	import type { ApiKey } from '../types';
	import { DEFAULT_EXPIRES_DAYS, MAX_EXPIRES_DAYS, validateApiKey } from './apiKeys';

	interface Account {
		id: string;
		full_name: string;
		email: string;
	}

	interface Props {
		open: boolean;
		/** активные служебные учётки роли «Интеграция» */
		accounts: Account[];
		accountsLoading: boolean;
		accountsError: boolean;
		onReloadAccounts: () => void;
		onClose: () => void;
		onCreated: (created: ApiKey, key: string) => void;
	}

	let { open, accounts, accountsLoading, accountsError, onReloadAccounts, onClose, onCreated }: Props = $props();

	let name = $state('');
	let userId = $state<string | null>(null);
	let days = $state<number | null>(DEFAULT_EXPIRES_DAYS);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = '';
			userId = null;
			days = DEFAULT_EXPIRES_DAYS;
			errors = {};
			formError = null;
			idemKey = crypto.randomUUID();
		});
	});
	// единственная учётка — выбрана сразу
	$effect(() => {
		if (open && userId === null && accounts.length === 1) userId = accounts[0].id;
	});

	async function save() {
		const next = validateApiKey({ name, userId, days });
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			const { key, ...saved } = await unwrap(api.POST('/api/admin/integrations/api-keys', { body: { name: name.trim(), user_id: userId!, expires_in_days: days }, headers: { 'Idempotency-Key': idemKey } }));
			onCreated(saved, key);
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['name', 'user_id', 'expires_in_days']);
			errors = { ...failure.fields, ...(failure.fields.user_id ? { user: failure.fields.user_id } : {}), ...(failure.fields.expires_in_days ? { days: failure.fields.expires_in_days } : {}) };
			formError = failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormDrawer {open} title="Новый API-ключ" width={480} {saving} {formError} saveLabel="Создать ключ" canSave={accountsLoading || accounts.length > 0} onSave={save} {onClose}>
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} placeholder="Например: сайт, LMS" hint="Чтобы потом понять, какой системе принадлежит ключ" autofocus />
	{#if accountsError}
		<Notice class="shrink-0" tone="error" actions={[{ label: 'Повторить', onclick: onReloadAccounts }]}>Не удалось загрузить служебные учётки.</Notice>
	{:else if !accountsLoading && accounts.length === 0}
		<Notice class="shrink-0" tone="warning">Нет активной служебной учётки с ролью «Интеграция». Ключ выпускается для неё: создайте такого пользователя в разделе «Пользователи».</Notice>
	{:else}
		<Pick label="Служебная учётка" required bind:value={userId} items={accounts.map((a) => ({ key: a.id, value: a.full_name, hint: a.email }))} error={errors.user} hint="Ключ действует с правами этой учётки" />
	{/if}
	<NumberField label="Срок действия, дней" required bind:value={days} integer min={1} max={MAX_EXPIRES_DAYS} error={errors.days} />
</FormDrawer>
