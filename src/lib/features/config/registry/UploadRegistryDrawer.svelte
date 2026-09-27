<script lang="ts">
	// Загрузка выгрузки ЕГРЮЛ: файл (.xml / .zip) → хранилище → задание импорта. Разбирается только выгрузка ФНС.
	import { untrack } from 'svelte';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { api, unwrap, idem, errorMessage } from '$lib/api';
	import { uploadFile } from '$lib/api/upload';
	import { Notice, toast } from '$lib/ui';
	import { formatBytes } from '$lib/utils/format';
	import { REGISTRY_SOURCES, SUPPORTED_REGISTRY_SOURCES } from '../labels';
	import { FormDrawer } from '$lib/ui';
	import FileField from '$lib/ui/fields/FileField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		onStarted: () => void;
	}

	let { open, onClose, onStarted }: Props = $props();

	type Source = 'fns_egrul' | 'rosobrnadzor' | 'manual';
	let source = $state<string | null>('fns_egrul');
	let file = $state<File | null>(null);
	let progress = $state(0);
	let saving = $state(false);
	let fileError = $state<string | null>(null);
	let formError = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			source = 'fns_egrul';
			file = null;
			progress = 0;
			fileError = null;
			formError = null;
		});
	});

	function pick(next: File | null) {
		fileError = null;
		file = next;
	}

	async function save() {
		if (!file) {
			fileError = 'Выберите файл выгрузки';
			return;
		}
		saving = true;
		formError = null;
		try {
			const uploaded = await uploadFile(file, { purpose: 'registry', onProgress: (f) => (progress = f) });
			await unwrap(api.POST('/api/admin/registry/import', { body: { file_id: uploaded.id, source: (source ?? 'fns_egrul') as Source }, headers: idem() }));
			toast.success('Загрузка запущена', 'Разбор выгрузки идёт в фоне');
			onStarted();
			onClose();
		} catch (e) {
			formError = errorMessage(e);
		} finally {
			saving = false;
		}
	}
</script>

<FormDrawer {open} title="Загрузить выгрузку" width={460} {saving} {formError} saveLabel="Загрузить" canSave={file !== null} dirty={file !== null} onSave={save} {onClose}>
	<Pick
		label="Источник"
		value={source}
		items={REGISTRY_SOURCES.map((s) => ({ key: s.key, value: s.value, hint: SUPPORTED_REGISTRY_SOURCES.has(s.key) ? undefined : 'пока не поддерживается', disabled: !SUPPORTED_REGISTRY_SOURCES.has(s.key) }))}
		onChange={(v) => v && (source = v)}
	/>
	<div class="flex flex-col gap-2">
		<FileField
			accept={{ 'text/xml': ['.xml'], 'application/xml': ['.xml'], 'application/zip': ['.zip'], 'application/x-zip-compressed': ['.zip'] }}
			label="Перетащите файл выгрузки"
			required
			hint="XML или ZIP с XML, выгрузка ЕГРЮЛ ФНС"
			disabled={saving}
			loading={saving}
			error={fileError ?? undefined}
			onPick={pick}
			onClear={() => pick(null)}
		/>
		{#if file}<p class="t-desc-l text-muted">{file.name} · {formatBytes(file.size)}</p>{/if}
		{#if fileError}<Notice class="shrink-0" tone="error">{fileError}</Notice>{/if}
		{#if saving}<Progress value={Math.round(progress * 100)} showValue label={progress >= 1 ? 'Запускаем разбор…' : 'Загружаем файл…'} />{/if}
	</div>
</FormDrawer>
