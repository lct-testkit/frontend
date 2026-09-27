<script lang="ts">
	// Шаг 2: какая колонка файла в какое поле системы. Автоподбор сервера + пресет; ошибки и предупреждения подсвечиваются сразу.
	import { goto } from '$app/navigation';
	import { Btn, DataTable, ErrorState, FormBody, Notice, Skeleton, TableCell, WizardCard, type Col } from '$lib/ui';
	import { formatNumber } from '$lib/utils/format';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import type { ImportFlow } from './flow.svelte';
	import { sampleValues } from './mapping';

	let { flow }: { flow: ImportFlow } = $props();

	interface MapRow {
		id: number;
		header: string;
		samples: string[];
	}

	// Поля типа приходят с сервера (`GET /api/imports/entity-types`): у каждого своя подпись и признак «обязательное».
	const items = $derived((flow.entityType?.fields ?? []).map((f) => ({ key: f.target, value: f.label, hint: f.required ? 'обязательное' : undefined })));
	const rows = $derived<MapRow[]>(flow.headers.map((h, i) => ({ id: i, header: h, samples: sampleValues(flow.profile?.sample_rows ?? [], i, 3) })));
	const duplicate = (target: string | undefined) => Boolean(target) && flow.check.duplicateTargets.includes(target as string);
	const samplesOf = (r: MapRow) => r.samples.join(' · ');

	// Таблица — тот же `DataTable`, что на шаге проверки: строка в одну линию, длинное — с многоточием и полной подсказкой.
	const columns: Col<MapRow>[] = [
		{ key: 'header', title: 'Колонка файла', width: 'minmax(180px, 1fr)', render: headerCell },
		{ key: 'samples', title: 'Примеры', width: 'minmax(200px, 1.4fr)', drop: 1, render: samplesCell },
		{ key: 'target', title: 'Поле системы', width: 'minmax(260px, 1.2fr)', render: targetCell }
	];
</script>

{#snippet headerCell(r: MapRow)}<TableCell><span class="t-body-s-strong truncate" title={r.header}>{r.header || '—'}</span></TableCell>{/snippet}
{#snippet samplesCell(r: MapRow)}
	<TableCell><span class={['t-body-s truncate', r.samples.length ? 'text-muted' : 'text-soft']} title={samplesOf(r)}>{r.samples.length ? samplesOf(r) : 'Пусто'}</span></TableCell>
{/snippet}
{#snippet targetCell(r: MapRow)}
	<TableCell class="py-1">{@render targetPick(r, 'm')}</TableCell>
{/snippet}
{#snippet targetPick(r: MapRow, size: 's' | 'm' | 'l' | undefined)}
	{@const target = flow.mapping[r.header]}
	<Pick
		{size}
		clearable
		search
		placeholder="Не импортировать"
		value={target || null}
		{items}
		error={duplicate(target) ? 'Поле уже выбрано для другой колонки' : undefined}
		onChange={(v) => flow.setTarget(r.header, v)}
	/>
{/snippet}
{#snippet card(r: MapRow)}
	<div class="flex min-w-0 flex-col gap-2">
		<span class="t-body-m-strong wrap-anywhere">{r.header || '—'}</span>
		<span class={['t-desc-l line-clamp-2 wrap-anywhere', r.samples.length ? 'text-muted' : 'text-soft']}>{r.samples.length ? samplesOf(r) : 'Пусто'}</span>
		{@render targetPick(r, undefined)}
	</div>
{/snippet}

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

		<DataTable {rows} {columns} {card} noFooter ariaLabel="Сопоставление колонок файла" />

		<div class="flex flex-col gap-3 rounded-md bg-surface-2 p-3">
			<Toggle label="Сохранить как пресет" checked={flow.savePreset} onChange={(v) => (flow.savePreset = v)} hint="Пригодится для следующих файлов с такими же колонками" />
			{#if flow.savePreset}<FormBody><TextField label="Название пресета" bind:value={flow.presetName} maxlength={80} /></FormBody>{/if}
		</div>

		{#snippet actions()}
			<Btn label="Далее" disabled={!flow.check.ok || (flow.savePreset && !flow.presetName.trim())} loading={flow.busy} onclick={() => flow.saveMapping()} />
			<Btn label="Отмена" variant="outline" colorScheme="neutral" onclick={() => goto('/imports')} />
		{/snippet}
	</WizardCard>
{/if}
