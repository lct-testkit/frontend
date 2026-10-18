<script lang="ts">
	// Карточка виджета: заголовок, содержимое (данные или подсказка «Обновите»), в режиме правки — влево / вправо / изменить / удалить.
	import { DropdownMenu } from '@lct-testkit/rt-ui';
	import { ArrowLeft, ArrowRight, Download, Edit, Trash } from '@lct-testkit/rt-ui/icons';
	import { IconBtn, Notice, Skeleton, StatusChip, toast } from '$lib/ui';
	import { GLOSSARY } from '$lib/ui/glossary';
	import { formatTime } from '$lib/utils/format';
	import type { DashboardWidget } from '../types';
	import { NOT_UPDATED, type DashboardData } from './dashboard-data.svelte';
	import { exportFileName, paramsSummary, renderCard, saveBlob, toPdf, toPng } from './chart-export';
	import { reportNotes } from './notes';
	import WidgetBody from './WidgetBody.svelte';
	import { effectiveParams, readConfig, type WidgetConfig } from './widgets';

	interface Props {
		widget: DashboardWidget;
		data: DashboardData;
		templateName: (code: string) => string;
		editing: boolean;
		/** может менять дашборд (владелец или администратор) */
		canEdit?: boolean;
		first: boolean;
		last: boolean;
		onMove: (dir: -1 | 1) => void;
		onEdit: () => void;
		onDelete: () => void;
		/** «Таблица (Excel, PDF)…»: открыть панель запуска отчёта с параметрами виджета */
		onExportTable?: (config: WidgetConfig) => void;
	}

	let { widget, data, templateName, editing, canEdit = false, first, last, onMove, onEdit, onDelete, onExportTable }: Props = $props();

	const config = $derived(readConfig(widget.config));
	const name = $derived(config ? templateName(config.template_code) : 'Виджет');
	const title = $derived(config?.title || name);
	const table = $derived(config ? data.table(config) : null);
	const loading = $derived(config ? data.isLoading(config) : false);
	const error = $derived(config ? data.errorOf(config) : null);
	const asOf = $derived(config ? data.asOf(config) : null);
	/** лимит отчётов — не сбой: у виджета остаются прошлые данные, о них сказано тихой строкой */
	const limitOnly = $derived(error === NOT_UPDATED);
	const stale = $derived(Boolean(error));
	const notes = $derived(
		table ? reportNotes({ rowCount: table.totalRows, truncated: table.truncated, totalRows: table.serverTotal, note: table.note, asOf: table.generatedAt }).filter((n) => n.kind !== 'info') : []
	);

	// --- выгрузка: PNG и PDF рисуются в браузере из того, что на экране (см. chart-export.ts); таблица — серверный отчёт ---------------------
	const PARAM_LABELS = { organization_ids: GLOSSARY.org.plural, direction_ids: GLOSSARY.direction.plural, product_ids: GLOSSARY.product.plural, owner_ids: GLOSSARY.deal_owner.plural };
	let articleEl = $state<HTMLElement | null>(null);
	let bodyEl = $state<HTMLElement | null>(null);
	let menuOpen = $state(false);
	let exporting = $state(false);

	const canPicture = $derived(widget.widget_type !== 'report_table');
	const menuItems = $derived([
		...(canPicture ? [{ key: 'png', value: 'PNG' }, { key: 'pdf', value: 'PDF' }] : []),
		{ key: 'table', value: 'Таблица (Excel, PDF)…' }
	]);

	async function exportPicture(kind: 'png' | 'pdf') {
		if (!config || !table || !articleEl || !bodyEl || exporting) return;
		exporting = true;
		try {
			const style = getComputedStyle(articleEl);
			const now = new Date();
			const tile = widget.widget_type === 'stat_tile' ? { value: bodyEl.querySelector('.t-h1')?.textContent?.trim() ?? '', label: bodyEl.querySelector('.t-desc-l')?.textContent?.trim() ?? '' } : undefined;
			const canvas = await renderCard({
				title,
				subtitle: paramsSummary(effectiveParams(config), PARAM_LABELS),
				svg: bodyEl.querySelector<SVGSVGElement>('svg.rt-chart__svg'),
				legend: bodyEl.querySelector<HTMLElement>('.rt-chart__legend'),
				tile,
				notes: reportNotes({ rowCount: table.totalRows, truncated: table.truncated, totalRows: table.serverTotal, note: table.note, asOf: table.generatedAt }).map((n) => n.text),
				footer: `Сформировано ${now.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}${asOf ? ` · Данные на ${formatTime(asOf)}` : ''} · RTK School CRM`,
				background: style.backgroundColor,
				foreground: style.color
			});
			saveBlob(kind === 'png' ? await toPng(canvas) : await toPdf(canvas), exportFileName(title, now, kind));
		} catch (e) {
			toast.error(e, 'Не удалось сформировать файл');
		} finally {
			exporting = false;
		}
	}

	function onPick(key: string | number) {
		menuOpen = false;
		if (key === 'png' || key === 'pdf') void exportPicture(key);
		else if (config) onExportTable?.(config);
	}
</script>

<article bind:this={articleEl} class="flex h-full min-w-0 flex-col rounded-lg border border-line bg-surface" aria-label={title}>
	<header class="flex items-center gap-1 px-4 pt-3 pb-1 max-md:px-3">
		<h3 class="t-body-m-strong min-w-0 flex-1 truncate">{title}</h3>
		{#if table}
			<DropdownMenu class="inline-flex w-auto" items={menuItems} isOpened={menuOpen} placement="bottomRight" onClose={() => (menuOpen = false)} onClickItem={(item: { key: string | number }) => onPick(item.key)}>
				<IconBtn icon={Download} label="Скачать" size="s" disabled={exporting} aria-busy={exporting} onclick={() => (menuOpen = !menuOpen)} />
			</DropdownMenu>
		{/if}
		{#if editing}
			<IconBtn icon={ArrowLeft} label="Сдвинуть назад" size="s" disabled={first} onclick={() => onMove(-1)} />
			<IconBtn icon={ArrowRight} label="Сдвинуть вперёд" size="s" disabled={last} onclick={() => onMove(1)} />
			<IconBtn icon={Edit} label="Изменить виджет" size="s" onclick={onEdit} />
			<IconBtn icon={Trash} label="Удалить виджет" size="s" danger onclick={onDelete} />
		{/if}
	</header>
	<div class="min-h-0 flex-1 px-4 pt-1 pb-4 max-md:px-3">
		{#if !config}
			<p class="t-body-s py-6 text-center text-danger">{canEdit ? 'Виджет настроен неверно — измените или удалите его' : 'Виджет настроен неверно. Сообщите владельцу дашборда'}</p>
		{:else if table}
			<div bind:this={bodyEl} class={loading ? 'opacity-50' : undefined}><WidgetBody type={widget.widget_type} {config} {table} {name} /></div>
			<p class="t-desc-m flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-soft">
				{#if asOf}<span>Данные на {formatTime(asOf)}{stale ? ' · не обновлено' : ''}</span>{/if}
				{#each notes as note (note.kind)}<StatusChip label={note.kind === 'truncated' ? 'Усечено' : 'Снимок'} tone={note.tone} hint={note.text} />{/each}
			</p>
			{#if error && !limitOnly}<p class="t-desc-m pt-1 text-muted">{error}</p>{/if}
		{:else if loading}
			<Skeleton kind="lines" rows={3} />
		{:else if error && !limitOnly}
			<Notice tone="error" class="shrink-0 my-3">{error}</Notice>
		{:else if error}
			<p class="t-body-s py-6 text-center text-soft">Нет данных — обновите позже</p>
		{:else}
			<p class="t-body-s py-6 text-center text-soft">Нет данных — нажмите «Обновить данные»</p>
		{/if}
	</div>
</article>
