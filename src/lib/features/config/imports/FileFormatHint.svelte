<script lang="ts">
	// «Какие колонки ждёт файл»: колонки выбранного типа (из `GET /api/imports/entity-types`), какие обязательные и в каком виде писать значение,
	// плюс шаблон для скачивания (xlsx и xls с сервера: заголовки, учебные строки, лист «Инструкция»). Список приходит с сервера — копий в интерфейсе нет.
	import { Download } from '@lct-testkit/rt-ui/icons';
	import { Btn, FormSection, StatusChip, toast } from '$lib/ui';
	import { plural } from '$lib/utils/format';
	import { fieldFormatHint, fieldLabel } from './hints';
	import { downloadImportTemplate, type TemplateFormat } from './job';
	import { entityInfo, type ImportEntityType } from './mapping';

	let { type }: { type: ImportEntityType } = $props();

	let loading = $state<TemplateFormat | null>(null);
	async function download(format: TemplateFormat) {
		if (loading) return;
		loading = format;
		try {
			await downloadImportTemplate(type.code, format);
		} catch (e) {
			toast.error(e, 'Не удалось скачать шаблон');
		} finally {
			loading = null;
		}
	}
</script>

<FormSection collapsible title="Какие колонки ждёт файл" summary={`${type.fields.length} ${plural(type.fields.length, ['колонка', 'колонки', 'колонок'])}`}>
	<p class="t-desc-l m-0 text-muted">Первая строка файла — названия колонок. Лишние колонки можно оставить: на следующем шаге их можно не загружать.</p>
	<ul class="m-0 flex list-none flex-col gap-2 p-0" aria-label="Колонки файла «{entityInfo(type).label}»">
		{#each type.fields as field (field.target)}
			<li class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-4 gap-y-1 max-md:grid-cols-1">
				<span class="t-row flex flex-wrap items-center gap-2 font-medium">
					{fieldLabel(field.label)}
					{#if field.required}<StatusChip label="Обязательная" tone="warning" />{/if}
				</span>
				<span class="t-desc-l text-muted">{fieldFormatHint(field.kind, field.target)}</span>
			</li>
		{/each}
	</ul>
	<p class="t-desc-l m-0 text-muted">Шаблон — заголовки, две учебные строки и лист «Инструкция» с допустимыми значениями. Учебные строки замените своими данными. В .xlsx есть выпадающие списки, в .xls их нет.</p>
	<div class="flex flex-wrap items-center gap-3 max-md:flex-col max-md:items-stretch">
		<Btn label="Скачать шаблон .xlsx" icon={Download} variant="outline" colorScheme="neutral" loading={loading === 'xlsx'} disabled={loading !== null} onclick={() => download('xlsx')} data-testid="import-template-xlsx" />
		<Btn label="Скачать шаблон .xls" icon={Download} variant="ghost" colorScheme="neutral" loading={loading === 'xls'} disabled={loading !== null} onclick={() => download('xls')} data-testid="import-template-xls" />
	</div>
</FormSection>
