<script lang="ts">
	// Шаг 2: какая колонка файла в какое поле системы. Автоподбор сервера + пресет; ошибки и предупреждения подсвечиваются сразу.
	import { goto } from '$app/navigation';
	import { Btn, DataTable, ErrorState, FormBody, FormSection, Notice, Skeleton, TableCell, WizardCard, type Col } from '$lib/ui';
	import { formatNumber } from '$lib/utils/format';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import type { ImportFlow } from './flow.svelte';
	import { duplicateHeaders, duplicateHeadersText } from './check';
	import { ENTITY_KEYS, presetKey, sampleValues } from './mapping';
	import { fieldLabel } from './hints';

	let { flow }: { flow: ImportFlow } = $props();

	interface MapRow {
		id: number;
		header: string;
		samples: string[];
	}

	// Поля типа приходят с сервера (`GET /api/imports/entity-types`): у каждого своя подпись и признак «обязательное».
	const items = $derived((flow.entityType?.fields ?? []).map((f) => ({ key: f.target, value: fieldLabel(f.label), hint: f.required ? 'обязательное' : undefined })));
	const rows = $derived<MapRow[]>(flow.headers.map((h, i) => ({ id: i, header: h, samples: sampleValues(flow.profile?.sample_rows ?? [], i, 3) })));
	const duplicate = (target: string | undefined) => Boolean(target) && flow.check.duplicateTargets.includes(target as string);
	const samplesOf = (r: MapRow) => r.samples.join(' · ');

	// --- Параметры чтения файла -----------------------------------------------------------------
	const sheets = $derived(flow.profile?.sheets ?? []);
	const isBook = $derived(flow.job?.source_format === 'xlsx' || flow.job?.source_format === 'xls');
	const suggestedRow = $derived(flow.profile?.suggested_header_row ?? 1);
	const currentRow = $derived(flow.profile?.header_row ?? 1);
	const dups = $derived(duplicateHeaders(flow.headers));
	const license = $derived(flow.entity === 'license');
	const optionsOpen = $derived(flow.optionsTouched || sheets.length > 1 || suggestedRow !== currentRow || flow.options.fillDown.length > 0);
	const optionsSummary = $derived(
		[flow.options.allSheets ? 'все листы' : flow.options.sheet && sheets.length > 1 ? `лист «${flow.options.sheet}»` : '', currentRow > 1 ? `заголовки в строке ${currentRow}` : '', flow.options.fillDown.length ? 'заполнение сверху' : '']
			.filter(Boolean)
			.join(', ')
	);

	// строка заголовка: ввод цифрами, перечитывание файла — когда человек закончил печатать
	let rowText = $state<number | null>(null);
	let rowTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		rowText = flow.options.headerRow ?? currentRow;
		return () => clearTimeout(rowTimer);
	});
	function onRow(v: number | null) {
		rowText = v;
		clearTimeout(rowTimer);
		if (v === null || v < 1 || v === flow.options.headerRow) return;
		rowTimer = setTimeout(() => flow.setOptions({ headerRow: v }, true), 600);
	}
	function onSheet(name: string | null) {
		if (!name) return;
		const sheet = sheets.find((s) => s.name === name);
		flow.setOptions({ sheet: name, headerRow: sheet?.suggested_header_row ?? 1 }, true);
	}

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
					items={flow.presets.map((p) => ({ key: presetKey(p), value: p.builtin ? `${p.name} (встроенный)` : p.name }))}
					onChange={(id) => flow.usePreset(id)}
				/>
			{/if}
		</div>

		{#if dups.length}<Notice class="shrink-0" tone="warning">{duplicateHeadersText(dups)}</Notice>{/if}
		{#if suggestedRow > currentRow}
			<Notice class="shrink-0" tone="info" actions={[{ label: `Взять строку ${suggestedRow}`, onclick: () => flow.setOptions({ headerRow: suggestedRow }, true) }]}>Похоже, названия колонок находятся в строке {suggestedRow}, а не в строке {currentRow}.</Notice>
		{/if}

		<FormSection collapsible title="Параметры чтения файла" open={optionsOpen} summary={optionsSummary}>
			<FormBody>
				{#if isBook && sheets.length > 1}
					{#if !flow.options.allSheets}
						<Pick label="Лист" value={flow.options.sheet} disabled={flow.previewing} items={sheets.map((s) => ({ key: s.name, value: s.visible ? s.name : `${s.name} (скрыт)`, hint: `${formatNumber(s.rows)} строк` }))} onChange={onSheet} />
					{/if}
					<Toggle label="Загрузить все листы книги" checked={flow.options.allSheets} onChange={(v) => flow.setOptions({ allSheets: v })} hint="Колонки на всех листах должны называться одинаково; предпросмотр — по первому листу" />
				{/if}
				{#if isBook}<NumberField label="Строка с названиями колонок" value={rowText} integer min={1} onChange={onRow} hint={suggestedRow > 1 ? `Подсказка: строка ${suggestedRow}` : 'Обычно первая строка'} disabled={flow.previewing} />{/if}
				<MultiPick label="Заполнять пустые ячейки значением сверху" value={flow.options.fillDown} items={flow.headers.filter(Boolean).map((h) => ({ key: h, value: h }))} placeholder="Не заполнять" hint="Для файлов, где вуз или вендор указан один раз на несколько строк (объединённые ячейки)" onChange={(v) => flow.setOptions({ fillDown: v })} />
				{#if license}
					<Toggle label="Создавать вендоров, которых нет в справочнике" checked={flow.options.createVendors} onChange={(v) => flow.setOptions({ createVendors: v })} />
					<Toggle label="Создавать программы (ПО), которых нет в справочнике" checked={flow.options.createSoftware} onChange={(v) => flow.setOptions({ createSoftware: v })} />
					<Toggle label="Создавать вузы, которых нет в справочнике" checked={flow.options.createOrganizations} onChange={(v) => flow.setOptions({ createOrganizations: v })} hint="Иначе строка с неизвестным вузом получит ошибку" />
				{/if}
			</FormBody>
		</FormSection>

		{#if ENTITY_KEYS[flow.entity]}<Notice class="shrink-0" tone="info" title="Как система узнаёт запись">{ENTITY_KEYS[flow.entity]}</Notice>{/if}

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
