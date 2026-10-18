<script lang="ts">
	// Филиал или институт вуза: название, адрес, родитель (другой филиал этого же вуза; сам филиал и его потомки не предлагаются).
	import { untrack } from 'svelte';
	import { ApiError, api, errorTextWithCode, unwrap } from '$lib/api';
	import { FormModal, Pick, TextField, toast } from '$lib/ui';
	import type { Branch } from '../types';
	import { parentOptions } from './branchTree';

	interface Props {
		open: boolean;
		orgId: string;
		/** все филиалы вуза (для выбора родителя) */
		items: Branch[];
		/** null = новый */
		item: Branch | null;
		onClose: () => void;
		onSaved: (branch: Branch, created: boolean) => void;
	}

	let { open, orgId, items, item, onClose, onSaved }: Props = $props();

	let name = $state('');
	let address = $state('');
	let parent = $state<string | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let fieldErrors = $state<{ name?: string; parent?: string }>({});

	let wasOpen = false;
	$effect(() => {
		const opened = open;
		untrack(() => {
			if (opened && !wasOpen) {
				name = item?.name ?? '';
				address = item?.address ?? '';
				parent = item?.parent_id ?? null;
				error = null;
				fieldErrors = {};
			}
			wasOpen = opened;
		});
	});

	const options = $derived(parentOptions(items, item?.id ?? null));
	const dirty = $derived(open && (name.trim() !== (item?.name ?? '') || address.trim() !== (item?.address ?? '') || parent !== (item?.parent_id ?? null)));

	async function submit() {
		if (busy) return;
		if (!name.trim()) {
			fieldErrors = { name: 'Укажите название' };
			return;
		}
		busy = true;
		error = null;
		try {
			const body = { name: name.trim(), address: address.trim() || null, parent_id: parent };
			const path = { organization_id: orgId };
			const saved = item
				? await unwrap(api.PATCH('/api/organizations/{organization_id}/branches/{branch_id}', { params: { path: { ...path, branch_id: item.id } }, body }))
				: await unwrap(api.POST('/api/organizations/{organization_id}/branches', { params: { path }, body }));
			toast.success(item ? 'Филиал сохранён' : 'Филиал добавлен');
			onSaved(saved, !item);
		} catch (e) {
			if (e instanceof ApiError && e.isValidation && e.errors.length) {
				const f = e.fieldErrors();
				fieldErrors = { name: f.name, parent: f.parent_id };
				if (!f.name && !f.parent_id) error = errorTextWithCode(e);
			} else error = errorTextWithCode(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormModal {open} size="s" title={item ? 'Изменить филиал' : 'Новый филиал'} saveLabel={item ? 'Сохранить' : 'Добавить'} saving={busy} {dirty} formError={error} onSave={submit} {onClose}>
	<TextField label="Название" required autofocus value={name} error={fieldErrors.name} maxlength={255} onInput={(v) => ((name = v), (fieldErrors = { ...fieldErrors, name: undefined }))} />
	<TextField label="Адрес" value={address} onInput={(v) => (address = v)} />
	<Pick label="Входит в" value={parent} items={options} clearable search={options.length > 8} placeholder="Верхний уровень" error={fieldErrors.parent} onChange={(v) => (parent = v)} hint="Институт или подразделение указывается внутри филиала" />
</FormModal>
