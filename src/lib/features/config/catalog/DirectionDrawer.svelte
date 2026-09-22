<script lang="ts">
	// Направление: код (только при создании), название, родитель. Из родителей исключены само направление и его потомки.
	import { untrack } from 'svelte';
	import { AddLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap, idem, ifMatch } from '$lib/api';
	import { Btn, toast } from '$lib/ui';
	import type { Direction } from '../types';
	import { FormDrawer } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { toFormFailure } from '../shared/form-errors';
	import { directionOptions, selfAndDescendants } from './directions';

	interface Props {
		open: boolean;
		/** null — создание; `presetParent` — родитель для нового */
		item: Direction | null;
		presetParent?: string | null;
		all: readonly Direction[];
		onClose: () => void;
		onSaved: () => void;
		onAddChild?: (parentId: string) => void;
	}

	let { open, item, presetParent = null, all, onClose, onSaved, onAddChild }: Props = $props();

	let code = $state('');
	let name = $state('');
	let parent = $state<string | null>(null);
	let version = $state(0);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	const isNew = $derived(item === null);
	const parents = $derived(directionOptions(all, item ? selfAndDescendants(all, item.id) : undefined));

	$effect(() => {
		void [item, presetParent];
		if (!open) return;
		untrack(() => {
			code = item?.code ?? '';
			name = item?.name ?? '';
			parent = item ? (item.parent_id ?? null) : presetParent;
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
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			if (item) {
				await unwrap(api.PATCH('/api/directions/{direction_id}', { params: { path: { direction_id: item.id } }, body: { name: name.trim(), parent_id: parent }, headers: ifMatch(version) }));
				toast.success('Направление сохранено');
			} else {
				await unwrap(api.POST('/api/directions', { body: { code: code.trim(), name: name.trim(), parent_id: parent }, headers: idem(idemKey) }));
				toast.success('Направление создано');
			}
			onSaved();
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['code', 'name', 'parent_id']);
			errors = failure.fields;
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	/** После конфликта версий: берём актуальную версию записи (направлений мало — одна страница на весь справочник), введённое остаётся в форме. */
	async function reloadVersion() {
		if (!item) return;
		try {
			const res = await unwrap(api.GET('/api/directions', { params: { query: { limit: 200 } } }));
			const fresh = res.items.find((d) => d.id === item.id);
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

<FormDrawer {open} title={isNew ? 'Новое направление' : name || 'Направление'} {saving} {formError} {conflict} onSave={save} {onClose} onReload={reloadVersion}>
	{#if isNew}
		<TextField label="Код" bind:value={code} error={errors.code} maxlength={64} autofocus />
	{:else}
		<TextField label="Код" value={code} readonly hint="Код после создания не меняется" />
	{/if}
	<TextField label="Название" bind:value={name} error={errors.name} maxlength={255} autofocus={!isNew} />
	<Pick label="Входит в" bind:value={parent} items={parents} clearable search error={errors.parent_id} hint="Пусто — направление верхнего уровня" />
	{#snippet extra()}
		{#if item && onAddChild}<Btn label="Подраздел" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={() => onAddChild(item.id)} />{/if}
	{/snippet}
</FormDrawer>
