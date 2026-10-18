<script lang="ts">
	// «Какие колонки ждёт файл»: колонки выбранного типа (из `GET /api/imports/entity-types`), какие обязательные и в каком виде писать значение,
	// плюс шаблон для скачивания. Список приходит с сервера — копий в интерфейсе нет.
	import { Download } from '@lct-testkit/rt-ui/icons';
	import { Btn, FormSection, StatusChip } from '$lib/ui';
	import { fieldFormatHint } from './hints';
	import { LICENSE_EXAMPLE, buildTemplateCsv, saveTextFile, templateFileName } from './licenseImport';
	import { entityInfo, type ImportEntityType } from './mapping';

	let { type }: { type: ImportEntityType } = $props();

	const example = $derived(type.code === 'license' ? LICENSE_EXAMPLE : null);
	const download = () => saveTextFile(templateFileName(type.code), buildTemplateCsv(type, example));
</script>

<FormSection collapsible title="Какие колонки ждёт файл" summary={`${type.fields.length}`}>
	<p class="t-desc-l m-0 text-muted">Первая строка файла — названия колонок. Лишние колонки можно оставить: на следующем шаге их можно не загружать.</p>
	<ul class="m-0 flex list-none flex-col gap-2 p-0" aria-label="Колонки файла «{entityInfo(type).label}»">
		{#each type.fields as field (field.target)}
			<li class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-4 gap-y-1 max-md:grid-cols-1">
				<span class="t-row flex flex-wrap items-center gap-2 font-medium">
					{field.label}
					{#if field.required}<StatusChip label="Обязательная" tone="warning" />{/if}
				</span>
				<span class="t-desc-l text-muted">{fieldFormatHint(field.kind)}</span>
			</li>
		{/each}
	</ul>
	{#if example}
		<p class="t-desc-l m-0 text-muted">В шаблоне вторая строка — пример: вуза с таким названием нет, поэтому при проверке она получит замечание «вуз не найден». Замените её своими данными.</p>
	{/if}
	<div class="flex flex-wrap items-center gap-3">
		<Btn label="Скачать шаблон (CSV)" icon={Download} variant="outline" colorScheme="neutral" onclick={download} data-testid="import-template" />
		<span class="t-desc-l text-muted">CSV с разделителем «;» — так его открывает русский Excel.</span>
	</div>
</FormSection>
