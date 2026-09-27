<script lang="ts">
	// Причина отказа: код (при создании), название, категория, «Активна». Порядок внутри категории меняется стрелками в списке.
	import { untrack } from 'svelte';
	import { api, unwrap, idem, ifMatch } from '$lib/api';
	import { toast } from '$lib/ui';
	import { LOSS_REASON_CATEGORIES } from '../labels';
	import type { LossReason } from '../types';
	import { FormDrawer } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../shared/form-errors';

	type Category = 'price' | 'timing' | 'competitor' | 'no_need' | 'no_budget' | 'no_contact' | 'other';

	interface Props {
		open: boolean;
		item: LossReason | null;
		/** sort_order новой причины — после последней */
		nextOrder: number;
		presetCategory?: string | null;
		onClose: () => void;
		onSaved: () => void;
	}

	let { open, item, nextOrder, presetCategory = null, onClose, onSaved }: Props = $props();

	let code = $state('');
	let name = $state('');
	let category = $state<string | null>(null);
	let isActive = $state(true);
	let version = $state(0);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	const isNew = $derived(item === null);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			code = item?.code ?? '';
			name = item?.name ?? '';
			category = item?.category ?? presetCategory;
			isActive = item?.is_active ?? true;
			version = item?.version ?? 0;
			errors = {};
			formError = null;
			conflict = false;
			idemKey = crypto.randomUUID();
		});
	});

	async function save() {
		const next: Record<string, string> = {};
		if (isNew && !code.trim()) next.code = 'Укажите код';
		if (!name.trim()) next.name = 'Укажите название';
		if (!category) next.category = 'Выберите категорию';
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			if (item) {
				await unwrap(
					api.PATCH('/api/loss-reasons/{loss_reason_id}', {
						params: { path: { loss_reason_id: item.id } },
						body: { name: name.trim(), category: category as Category, is_active: isActive },
						headers: ifMatch(version)
					})
				);
				toast.success('Причина сохранена');
			} else {
				await unwrap(
					api.POST('/api/loss-reasons', { body: { code: code.trim(), name: name.trim(), category: category as Category, is_active: isActive, sort_order: nextOrder }, headers: idem(idemKey) })
				);
				toast.success('Причина добавлена');
			}
			onSaved();
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['code', 'name', 'category']);
			errors = failure.fields;
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	/** После конфликта версий: берём актуальную версию записи, введённое остаётся в форме. */
	async function reload() {
		if (!item) return;
		try {
			const res = await unwrap(api.GET('/api/loss-reasons', {}));
			const fresh = res.items.find((r) => r.id === item.id);
			if (fresh) {
				version = fresh.version;
				conflict = false;
				toast.info('Загружена актуальная версия', 'Проверьте поля и сохраните ещё раз');
			}
		} catch (e) {
			toast.error(e);
		} finally {
			onSaved();
		}
	}
</script>

<FormDrawer {open} title={isNew ? 'Новая причина отказа' : name || 'Причина отказа'} {saving} {formError} {conflict} onSave={save} {onClose} onReload={reload}>
	{#if isNew}
		<TextField label="Код" required bind:value={code} error={errors.code} maxlength={64} autofocus />
	{:else}
		<TextField label="Код" value={code} readonly hint="Код после создания не меняется" />
	{/if}
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} autofocus={!isNew} />
	<Pick label="Категория" required bind:value={category} items={LOSS_REASON_CATEGORIES.map((c) => ({ key: c.key, value: c.value }))} error={errors.category} />
	<Toggle label="Активна" bind:checked={isActive} />
</FormDrawer>
