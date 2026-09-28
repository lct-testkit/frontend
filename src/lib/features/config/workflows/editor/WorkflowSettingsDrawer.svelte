<script lang="ts">
	// Название и «по умолчанию» — то, что PATCH /api/workflows/{id} умеет менять без публикации
	// (граф и опубликованный снимок не меняются, версия воронки растёт).
	import { untrack } from 'svelte';
	import { api, unwrap, ifMatch } from '$lib/api';
	import { FormDrawer, toast } from '$lib/ui';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../../shared/form-errors';
	import type { Workflow } from '../../types';

	interface Props {
		open: boolean;
		workflow: Workflow | null;
		onClose: () => void;
		onSaved: (workflow: Workflow) => void;
	}

	let { open, workflow, onClose, onSaved }: Props = $props();

	let name = $state('');
	let isDefault = $state(false);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let version = $state(0);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = workflow?.name ?? '';
			isDefault = workflow?.is_default ?? false;
			version = workflow?.version ?? 0;
			errors = {};
			formError = null;
			conflict = false;
		});
	});

	async function save() {
		if (!workflow) return;
		if (!name.trim()) {
			errors = { name: 'Укажите название' };
			return;
		}
		saving = true;
		formError = null;
		try {
			const saved = await unwrap(
				api.PATCH('/api/workflows/{workflow_id}', { params: { path: { workflow_id: workflow.id } }, body: { name: name.trim(), is_default: isDefault }, headers: ifMatch(version) })
			);
			toast.success('Воронка сохранена');
			onSaved(saved);
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
		if (!workflow) return;
		try {
			const fresh = await unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: workflow.id } } }));
			version = fresh.workflow.version;
			conflict = false;
			toast.info('Загружена актуальная версия', 'Проверьте поля и сохраните ещё раз');
		} catch (e) {
			toast.error(e);
		}
	}
</script>

<FormDrawer {open} title="Название и по умолчанию" width={420} {saving} {formError} {conflict} onSave={save} {onClose} onReload={reloadVersion}>
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} autofocus />
	<Toggle
		label="Воронка по умолчанию"
		bind:checked={isDefault}
		hint={workflow?.state === 'published'
			? 'У опубликованной воронки этого типа сделки флаг сразу снимется с прежней воронки по умолчанию'
			: 'У черновика флаг вступит в силу только при публикации'}
	/>
</FormDrawer>
