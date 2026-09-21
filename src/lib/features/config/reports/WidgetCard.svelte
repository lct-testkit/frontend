<script lang="ts">
	// Карточка виджета: заголовок, содержимое (данные или подсказка «Обновите»), в режиме правки — влево / вправо / изменить / удалить.
	import { ArrowLeft, ArrowRight, Edit, Trash } from '@lct-testkit/rt-ui/icons';
	import { IconBtn, Notice, Skeleton } from '$lib/ui';
	import type { DashboardWidget } from '../types';
	import type { DashboardData } from './dashboard-data.svelte';
	import WidgetBody from './WidgetBody.svelte';
	import { readConfig } from './widgets';

	interface Props {
		widget: DashboardWidget;
		data: DashboardData;
		templateName: (code: string) => string;
		editing: boolean;
		first: boolean;
		last: boolean;
		onMove: (dir: -1 | 1) => void;
		onEdit: () => void;
		onDelete: () => void;
	}

	let { widget, data, templateName, editing, first, last, onMove, onEdit, onDelete }: Props = $props();

	const config = $derived(readConfig(widget.config));
	const name = $derived(config ? templateName(config.template_code) : 'Виджет');
	const title = $derived(config?.title || name);
	const table = $derived(config ? data.table(config) : null);
	const loading = $derived(config ? data.isLoading(config) : false);
	const error = $derived(config ? data.errorOf(config) : null);
</script>

<article class="flex h-full min-w-0 flex-col rounded-lg border border-line bg-surface" aria-label={title}>
	<header class="flex items-center gap-1 px-4 pt-3 pb-1 max-md:px-3">
		<h3 class="t-body-m-strong min-w-0 flex-1 truncate">{title}</h3>
		{#if editing}
			<IconBtn icon={ArrowLeft} label="Сдвинуть назад" size="s" disabled={first} onclick={() => onMove(-1)} />
			<IconBtn icon={ArrowRight} label="Сдвинуть вперёд" size="s" disabled={last} onclick={() => onMove(1)} />
			<IconBtn icon={Edit} label="Изменить виджет" size="s" onclick={onEdit} />
			<IconBtn icon={Trash} label="Удалить виджет" size="s" danger onclick={onDelete} />
		{/if}
	</header>
	<div class="min-h-0 flex-1 px-4 pt-1 pb-4 max-md:px-3">
		{#if !config}
			<p class="t-body-s py-6 text-center text-danger">Виджет настроен неверно — измените или удалите его</p>
		{:else if table}
			<div class={loading ? 'opacity-50' : undefined}><WidgetBody type={widget.widget_type} {config} {table} {name} /></div>
		{:else if loading}
			<Skeleton kind="lines" rows={3} />
		{:else if error}
			<Notice tone="error" class="shrink-0 my-3">{error}</Notice>
		{:else}
			<p class="t-body-s py-6 text-center text-soft">Нет данных — нажмите «Обновить данные»</p>
		{/if}
	</div>
</article>
