<script lang="ts">
	// Шаг 2: какая колонка файла в какое поле системы. Автоподбор сервера + пресет; ошибки и предупреждения подсвечиваются сразу.
	import { goto } from '$app/navigation';
	import { Btn, ErrorState, Notice, Skeleton, WizardCard } from '$lib/ui';
	import { formatNumber } from '$lib/utils/format';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import type { ImportFlow } from './flow.svelte';
	import { sampleValues } from './mapping';

	let { flow }: { flow: ImportFlow } = $props();

	// Поля типа приходят с сервера (`GET /api/imports/entity-types`): у каждого своя подпись и признак «обязательное».
	const items = $derived((flow.entityType?.fields ?? []).map((f) => ({ key: f.target, value: f.label, hint: f.required ? 'обязательное' : undefined })));
	const rows = $derived(flow.headers.map((h, i) => ({ header: h, samples: sampleValues(flow.profile?.sample_rows ?? [], i, 3) })));
	const duplicate = (target: string | undefined) => Boolean(target) && flow.check.duplicateTargets.includes(target as string);
</script>

{#if flow.error || flow.typesError}
	<WizardCard><ErrorState error={flow.error ?? flow.typesError} onRetry={() => (flow.typesError ? flow.loadTypes() : flow.loadProfile())} compact /></WizardCard>
{:else if flow.loading || !flow.profile || !flow.entityType}
	<WizardCard><Skeleton kind="rows" rows={6} /></WizardCard>
{:else}
	<WizardCard>
		<div class="flex flex-wrap items-end justify-between gap-3">
			<p class="t-body-m">В файле <b>{formatNumber(flow.profile.total_rows)}</b> строк, колонок: {flow.headers.length}</p>
			{#if flow.presets.length}
				<Pick
					class="w-64 max-md:w-full"
					clearable
					placeholder="Применить пресет"
					value={flow.presetId}
					items={flow.presets.map((p) => ({ key: p.id, value: p.name }))}
					onChange={(id) => flow.usePreset(id)}
				/>
			{/if}
		</div>

		{#each flow.check.errors as e (e)}
			<Notice class="shrink-0" tone="error">{e}</Notice>
		{/each}
		{#if flow.check.missing.length}
			<Notice class="shrink-0" tone="warning">Чтобы строки можно было загрузить, сопоставьте: {flow.check.missing.join(', ')}.</Notice>
		{/if}

		<div class="overflow-hidden rounded-lg border border-line bg-surface">
			<div class="t-desc-l grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-x-4 bg-surface-2 px-4 py-2 text-muted max-md:hidden">
				<span>Колонка файла</span><span>Примеры</span><span>Поле системы</span>
			</div>
			{#each rows as row (row.header)}
				{@const target = flow.mapping[row.header]}
				<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 max-md:grid-cols-1 max-md:px-3 max-md:first-of-type:border-t-0">
					<span class="t-body-m-strong wrap-anywhere">{row.header || '—'}</span>
					<span class="t-desc-l wrap-anywhere text-muted">{row.samples.length ? row.samples.join(' · ') : 'пусто'}</span>
					<Pick
						clearable
						search
						placeholder="Не импортировать"
						value={target || null}
						items={items}
						error={duplicate(target) ? 'Поле уже выбрано для другой колонки' : undefined}
						onChange={(v) => flow.setTarget(row.header, v)}
					/>
				</div>
			{/each}
		</div>

		<div class="flex flex-col gap-3 rounded-md bg-surface-2 p-3">
			<Toggle label="Сохранить как пресет" checked={flow.savePreset} onChange={(v) => (flow.savePreset = v)} hint="Пригодится для следующих файлов с такими же колонками" />
			{#if flow.savePreset}<TextField label="Название пресета" bind:value={flow.presetName} maxlength={80} />{/if}
		</div>

		{#snippet actions()}
			<Btn label="Далее" disabled={!flow.check.ok || (flow.savePreset && !flow.presetName.trim())} loading={flow.busy} onclick={() => flow.saveMapping()} />
			<Btn label="Отмена" variant="outline" colorScheme="neutral" onclick={() => goto('/imports')} />
		{/snippet}
	</WizardCard>
{/if}
