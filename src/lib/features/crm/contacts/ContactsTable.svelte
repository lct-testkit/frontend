<script lang="ts">
	// Список контактов: таблица или карточки. E-mail и телефон приходят маскированными — полные значения только через «Показать» в карточке.
	// Одна строка на контакт, одна высота у всех строк: должность, организация, e-mail, телефон — отдельные колонки (узкое окно их убирает).
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Pager } from '$lib/api/pager.svelte';
	import { DataTable, StatusChip, TableCell, type Col } from '$lib/ui';
	import { formatPhone } from '$lib/utils/format';
	import { orgCache, orgLabel, contactFullName } from '../shared/entityCache.svelte';
	import type { Contact } from '../types';

	interface Props {
		pager: Pager<Contact>;
		showOrganization?: boolean;
		empty?: Snippet;
		fill?: boolean;
	}

	let { pager, showOrganization = true, empty, fill = false }: Props = $props();

	$effect(() => {
		if (showOrganization) orgCache.ensure(pager.items.map((c) => c.organization_id));
	});

	const open = (row: Contact) => void goto(`/contacts/${row.id}`);
	// a plain click is the row's (it navigates); Ctrl/⌘/middle click on the name opens a new tab natively
	function link(e: MouseEvent) {
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) e.stopPropagation();
		else e.preventDefault();
	}

	const columns: Col<Contact>[] = $derived([
		{ key: 'name', title: 'Контакт', width: 'minmax(220px, 2fr)', render: nameCell },
		{ key: 'position', title: 'Должность', width: 'minmax(160px, 1.5fr)', render: positionCell, drop: 3 },
		...(showOrganization ? [{ key: 'org', title: 'Организация', width: 'minmax(160px, 1.4fr)', render: orgCell, drop: 4 }] : []),
		{ key: 'email', title: 'E-mail', render: emailCell, drop: 1 },
		{ key: 'phone', title: 'Телефон', render: phoneCell, drop: 2 },
		{ key: 'dm', title: 'ЛПР', render: dmCell }
	]);
</script>

{#snippet nameCell(row: Contact)}
	<TableCell><a href="/contacts/{row.id}" class="truncate font-medium text-fg" onclick={link}>{contactFullName(row)}</a></TableCell>
{/snippet}
{#snippet positionCell(row: Contact)}<TableCell><span class="truncate">{row.position || '—'}</span></TableCell>{/snippet}
{#snippet orgCell(row: Contact)}<TableCell><span class="truncate">{row.organization_id ? orgLabel(row.organization_id) : '—'}</span></TableCell>{/snippet}
{#snippet emailCell(row: Contact)}<TableCell><span class="truncate text-muted">{row.email ?? '—'}</span></TableCell>{/snippet}
{#snippet phoneCell(row: Contact)}<TableCell><span class="whitespace-nowrap text-muted">{formatPhone(row.phone)}</span></TableCell>{/snippet}
{#snippet dmCell(row: Contact)}
	<TableCell>
		{#if row.is_anonymized}<StatusChip label="Обезличен" tone="neutral" />{:else if row.is_decision_maker}<StatusChip label="ЛПР" tone="info" />{:else}<span class="text-soft">—</span>{/if}
	</TableCell>
{/snippet}

{#snippet card(row: Contact)}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-start justify-between gap-2">
			<span class="t-row-strong break-words">{contactFullName(row)}</span>
			{#if row.is_decision_maker}<StatusChip label="ЛПР" tone="info" />{/if}
		</div>
		{#if row.position}<span class="t-desc-l text-muted">{row.position}</span>{/if}
		{#if showOrganization && row.organization_id}<span class="t-desc-l truncate text-muted">{orgLabel(row.organization_id)}</span>{/if}
		<span class="t-desc-l text-muted">{formatPhone(row.phone)}</span>
	</div>
{/snippet}

<DataTable
	id="contacts"
	rows={pager.items}
	{columns}
	{card}
	{fill}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	onRowClick={open}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	{empty}
	emptyText="Контактов нет"
	ariaLabel="Контакты"
/>
