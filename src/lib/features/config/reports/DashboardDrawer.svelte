<script lang="ts">
	// Создание и правка дашборда: название и «Общий» (виден всем сотрудникам с доступом к отчётам).
	import { untrack } from 'svelte';
	import { api, unwrap, idem, ifMatch } from '$lib/api';
	import { toast } from '$lib/ui';
	import type { Dashboard } from '../types';
	import { FormDrawer } from '$lib/ui';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../shared/form-errors';

	interface Props {
		open: boolean;
		item: Dashboard | null;
		onClose: () => void;
		onSaved: (dashboard: Dashboard, created: boolean) => void;
	}

	let { open, item, onClose, onSaved }: Props = $props();

	let name = $state('');
	let shared = $state(false);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let version = $state(0);
	let idemKey = crypto.randomUUID();

	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = item?.name ?? '';
			shared = item?.is_shared ?? false;
			version = item?.version ?? 0;
			errors = {};
			formError = null;
			conflict = false;
			idemKey = crypto.randomUUID();
		});
	});

	async function save() {
		if (!name.trim()) {
			errors = { name: 'Укажите название' };
			return;
		}
		saving = true;
		formError = null;
		try {
			if (item) {
				const saved = await unwrap(api.PATCH('/api/dashboards/{dashboard_id}', { params: { path: { dashboard_id: item.id } }, body: { name: name.trim(), is_shared: shared }, headers: ifMatch(version) }));
				toast.success('Дашборд сохранён');
				onSaved(saved, false);
			} else {
				const created = await unwrap(api.POST('/api/dashboards', { body: { name: name.trim(), is_shared: shared }, headers: idem(idemKey) }));
				toast.success('Дашборд создан');
				onSaved(created, true);
			}
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['name']);
			errors = failure.fields;
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	async function reloadVersion() {
		if (!item) return;
		try {
			const fresh = await unwrap(api.GET('/api/dashboards/{dashboard_id}', { params: { path: { dashboard_id: item.id } } }));
			version = fresh.version;
			conflict = false;
			toast.info('Загружена актуальная версия', 'Проверьте поля и сохраните ещё раз');
		} catch (e) {
			toast.error(e);
		}
	}
</script>

<FormDrawer {open} title={item ? 'Дашборд' : 'Новый дашборд'} width={420} {saving} {formError} {conflict} saveLabel={item ? 'Сохранить' : 'Создать'} onSave={save} {onClose} onReload={reloadVersion}>
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} autofocus />
	<Toggle label="Общий" bind:checked={shared} hint="Виден всем, кому доступны отчёты; менять может только владелец" />
</FormDrawer>
