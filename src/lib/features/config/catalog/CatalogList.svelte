<script lang="ts" generics="Row extends { id: string | number }">
	// Общий список справочника: таблица на десктопе и планшете, карточки на телефоне; клик по строке открывает панель правки (только с catalog:write).
	import type { Snippet } from 'svelte';
	import { AddLarge } from '@lct-testkit/rt-ui/icons';
	import { Btn, EmptyState, DataTable, type Col } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';

	interface Props {
		rows: Row[];
		columns: Col<Row>[];
		/** карточка строки на телефоне */
		card: Snippet<[Row]>;
		loading?: boolean;
		error?: unknown;
		onRetry?: () => void;
		/** включён поиск или фильтр — пустой результат не предлагает «Создать» */
		filtered?: boolean;
		/** «Продуктов пока нет» */
		emptyText: string;
		createLabel?: string;
		onCreate?: () => void;
		onEdit?: (row: Row) => void;
		hasMore?: boolean;
		loadingMore?: boolean;
		onLoadMore?: () => void;
		ariaLabel?: string;
	}

	let { rows, columns, card, loading = false, error = null, onRetry, filtered = false, emptyText, createLabel = 'Создать', onCreate, onEdit, hasMore = false, loadingMore = false, onLoadMore, ariaLabel }: Props = $props();

	const canWrite = $derived(session.can('catalog:write'));
</script>

<DataTable
	{rows}
	{columns}
	{card}
	{loading}
	{error}
	{onRetry}
	{hasMore}
	{loadingMore}
	{onLoadMore}
	{ariaLabel}
	onRowClick={canWrite ? onEdit : undefined}
>
	{#snippet empty()}
		{#if filtered}
			<EmptyState title="Ничего не найдено" compact />
		{:else}
			<EmptyState title={emptyText}>
				{#snippet action()}
					{#if canWrite && onCreate}<Btn label={createLabel} icon={AddLarge} variant="outline" colorScheme="neutral" onclick={onCreate} />{/if}
				{/snippet}
			</EmptyState>
		{/if}
	{/snippet}
</DataTable>
