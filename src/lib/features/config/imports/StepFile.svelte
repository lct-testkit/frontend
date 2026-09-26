<script lang="ts">
	// Шаг 1: что загружаем, как обрабатывать существующие записи, файл (перетаскиванием или выбором).
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { Btn, ErrorState, Notice, RadioField, Skeleton, WizardCard } from '$lib/ui';
	import { formatBytes } from '$lib/utils/format';
	import FileField from '$lib/ui/fields/FileField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import type { ImportFlow } from './flow.svelte';
	import { IMPORT_ACCEPT, IMPORT_MODES, IMPORT_MODE_LABELS, entityInfo, type ImportEntity } from './mapping';

	let { flow }: { flow: ImportFlow } = $props();
</script>

{#if flow.typesError}
	<WizardCard><ErrorState error={flow.typesError} onRetry={() => flow.loadTypes()} compact /></WizardCard>
{:else if flow.typesLoading || !flow.entityTypes.length}
	<WizardCard><Skeleton kind="rows" rows={4} /></WizardCard>
{:else}
<WizardCard>
	<RadioField
		label="Что загружаем"
		columns={2}
		value={flow.entity}
		disabled={flow.uploading}
		items={flow.entityTypes.map((t) => ({ key: t.code, label: entityInfo(t).label, hint: entityInfo(t).hint }))}
		onChange={(v) => (flow.entity = v as ImportEntity)}
	/>

	<Pick
		label="Существующие записи"
		value={flow.mode}
		disabled={flow.uploading}
		hint={IMPORT_MODE_LABELS[flow.mode].hint}
		items={IMPORT_MODES.map((m) => ({ key: m, value: IMPORT_MODE_LABELS[m].label }))}
		onChange={(v) => v && (flow.mode = v as typeof flow.mode)}
	/>

	<section class="flex flex-col gap-2" aria-label="Файл">
		<FileField
			accept={IMPORT_ACCEPT}
			label="Перетащите файл сюда"
			hint="Excel (.xlsx, .xls), CSV или JSON, до 50 МБ"
			disabled={flow.uploading}
			loading={flow.uploading}
			error={flow.fileError ?? undefined}
			onPick={(file) => flow.pickFile(file)}
			onClear={() => flow.pickFile(null)}
		/>
		{#if flow.uploading}
			<Progress value={Math.round(flow.progress * 100)} showValue label={flow.progress >= 1 ? 'Обрабатываем файл…' : 'Загружаем файл…'} />
		{/if}
		{#if flow.fileError}<Notice class="shrink-0" tone="error">{flow.fileError}</Notice>{/if}
		{#if flow.file && !flow.fileError}<p class="t-desc-l text-muted">{flow.file.name} · {formatBytes(flow.file.size)}</p>{/if}
	</section>

	{#snippet actions()}
		<Btn label="Загрузить и продолжить" disabled={!flow.file || Boolean(flow.fileError)} loading={flow.uploading} onclick={() => flow.upload()} />
	{/snippet}
</WizardCard>
{/if}
