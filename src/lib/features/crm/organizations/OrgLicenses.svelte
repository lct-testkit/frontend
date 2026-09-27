<script lang="ts">
	// Вкладка «Лицензии» карточки организации: лицензии/договоры вуз-вендор-ПО (rtk_requiriments.md разд. 4, Треб.1).
	// Только чтение — у бэкенда нет create/edit ручек (загружаются импортом xls, catalog.router), поэтому здесь нет форм и кнопок.
	// ФИО менеджера и «ответственные от вуза» бэкенд может отдать маскированными (без права contact:reveal) — показываем как пришло.
	import { onMount, untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { DataTable, EmptyState, StatusChip, TableCell, type Col } from '$lib/ui';
	import { formatDate } from '$lib/utils/format';
	import { TRANSFER_STATUS_SCHEMES } from '../shared/labels';
	import type { OrganizationLicense } from '../types';
	import { licenseTermLabel, transferStatusLabel } from './licenseUtils';

	let { orgId }: { orgId: string } = $props();

	const pager = createPager<OrganizationLicense>(async (cursor, signal) =>
		unwrap(api.GET('/api/organization-licenses', { params: { query: { organization_id: orgId, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);
	onMount(() => untrack(() => void pager.reload()));

	const columns: Col<OrganizationLicense>[] = [
		{ key: 'vendor', title: 'Вендор', width: 'minmax(120px, 1.2fr)', render: vendorCell },
		{ key: 'product', title: 'ПО', width: 'minmax(140px, 1.4fr)', render: productCell },
		{ key: 'transfer_status', title: 'Передача', render: statusCell },
		{ key: 'license_signed_at', title: 'Подписан', render: signedCell, drop: 4 },
		{ key: 'license_valid_year', title: 'Срок', render: termCell, drop: 3 },
		{ key: 'contract_number', title: 'Договор №', render: contractCell, drop: 5 },
		{ key: 'manager_full_name', title: 'Менеджер', width: 'minmax(120px, 1fr)', render: managerCell, drop: 2 },
		{ key: 'responsible_contacts', title: 'Ответственные от вуза', width: 'minmax(140px, 1.2fr)', render: respCell, drop: 1 }
	];
</script>

{#snippet vendorCell(row: OrganizationLicense)}<TableCell><span class="truncate font-medium text-fg">{row.vendor}</span></TableCell>{/snippet}
{#snippet productCell(row: OrganizationLicense)}<TableCell><span class="truncate">{row.product_name}</span></TableCell>{/snippet}
{#snippet statusCell(row: OrganizationLicense)}<TableCell><StatusChip label={transferStatusLabel(row.transfer_status)} tone={row.transfer_status ? TRANSFER_STATUS_SCHEMES[row.transfer_status] ?? 'neutral' : 'neutral'} /></TableCell>{/snippet}
{#snippet signedCell(row: OrganizationLicense)}<TableCell><span class="whitespace-nowrap text-muted">{row.license_signed_at ? formatDate(row.license_signed_at) : '—'}</span></TableCell>{/snippet}
{#snippet termCell(row: OrganizationLicense)}<TableCell><span class="whitespace-nowrap text-muted">{licenseTermLabel(row.license_valid_year)}</span></TableCell>{/snippet}
{#snippet contractCell(row: OrganizationLicense)}<TableCell><span class="truncate text-muted">{row.contract_number}</span></TableCell>{/snippet}
{#snippet managerCell(row: OrganizationLicense)}<TableCell><span class="truncate text-muted">{row.manager_full_name ?? '—'}</span></TableCell>{/snippet}
{#snippet respCell(row: OrganizationLicense)}<TableCell><span class="truncate text-muted">{row.responsible_contacts ?? '—'}</span></TableCell>{/snippet}

{#snippet card(row: OrganizationLicense)}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-start justify-between gap-2">
			<span class="t-row-strong break-words">{row.vendor} · {row.product_name}</span>
			<StatusChip label={transferStatusLabel(row.transfer_status)} tone={row.transfer_status ? TRANSFER_STATUS_SCHEMES[row.transfer_status] ?? 'neutral' : 'neutral'} />
		</div>
		<span class="t-desc-l text-muted">Договор № {row.contract_number}</span>
		<span class="t-desc-l text-muted">Подписан: {row.license_signed_at ? formatDate(row.license_signed_at) : '—'} · Срок: {licenseTermLabel(row.license_valid_year)}</span>
		{#if row.manager_full_name}<span class="t-desc-l text-muted">Менеджер: {row.manager_full_name}</span>{/if}
		{#if row.responsible_contacts}<span class="t-desc-l text-muted wrap-anywhere">Ответственные от вуза: {row.responsible_contacts}</span>{/if}
		{#if row.comment}<span class="t-desc-l text-soft wrap-anywhere">{row.comment}</span>{/if}
	</div>
{/snippet}

<DataTable
	id="org-licenses"
	rows={pager.items}
	{columns}
	{card}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	emptyText="Лицензий и договоров нет"
	ariaLabel="Лицензии и договоры"
>
	{#snippet empty()}<EmptyState title="Лицензий и договоров нет" hint="Загружаются через импорт — создать или изменить в карточке нельзя." compact />{/snippet}
</DataTable>
