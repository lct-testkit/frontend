<script lang="ts">
	// Таблица лицензий вуз–вендор–ПО: десять колонок ТЗ (§4 п.1) в порядке ТЗ; на телефоне — карточки со всеми десятью полями.
	// Данные и догрузка — у родителя (Pager): сюда приходят строки и состояния. Что не помещается, отпадает по порядку `drop`
	// (сначала «Комментарий», потом «Ответственные», «Менеджер», «Подписание»). Заголовки укорочены (полное название поля ТЗ — в подсказке), всё равно десять колонок не помещаются на 1440 при открытом меню: полный набор — на широком экране (≥1800), в панели по клику на строку и в карточке на телефоне, а не режется и не прокручивается вбок.
	import type { Snippet } from 'svelte';
	import { DataTable, StatusChip, TableCell, type Col } from '$lib/ui';
	import { TRANSFER_STATUS_SCHEMES } from '../shared/labels';
	import type { OrganizationLicense } from '../types';
	import { LICENSE_COLUMN_TITLES, LICENSE_FIELD_LABELS, licenseOrgTitle, shortVendor, licenseSignedText, licenseTermInfo, transferStatusLabel } from './licenseUtils';

	interface Props {
		rows: OrganizationLicense[];
		loading?: boolean;
		error?: unknown;
		onRetry?: () => void;
		hasMore?: boolean;
		loadingMore?: boolean;
		onLoadMore?: () => void;
		total?: number;
		onRowClick?: (row: OrganizationLicense) => void;
		/** колонка «Название ВУЗа» (в карточке самого вуза она не нужна) */
		showOrganization?: boolean;
		/** внутри карточки-секции: без своей рамки */
		embedded?: boolean;
		fill?: boolean;
		empty?: Snippet;
		id?: string;
	}

	let { rows, loading = false, error = null, onRetry, hasMore = false, loadingMore = false, onLoadMore, total, onRowClick, showOrganization = true, embedded = false, fill = false, empty, id = 'licenses' }: Props = $props();

	const L = LICENSE_FIELD_LABELS;
	const T = LICENSE_COLUMN_TITLES;
	const now = new Date();
	const dash = '—';

	const columns: Col<OrganizationLicense>[] = $derived([
		...(showOrganization ? [{ key: 'organization_name', title: T[0], hint: L[0], width: 'minmax(110px, 1fr)', render: orgCell }] : []),
		{ key: 'vendor', title: T[1], width: 'minmax(105px, 1.4fr)', render: vendorCell },
		{ key: 'product_name', title: T[2], width: 'minmax(110px, 2fr)', render: productCell },
		{ key: 'contract_number', title: T[3], hint: L[3], width: 'minmax(140px, 1fr)', render: contractCell },
		{ key: 'signed', title: T[4], hint: L[4], render: signedCell, drop: 4 },
		{ key: 'term', title: T[5], hint: L[5], render: termCell },
		{ key: 'transfer_status', title: T[6], hint: L[6], render: statusCell },
		{ key: 'manager_full_name', title: T[7], hint: L[7], width: 'minmax(110px, 1fr)', render: managerCell, drop: 3 },
		{ key: 'responsible_contacts', title: T[8], hint: L[8], width: 'minmax(110px, 1.2fr)', render: respCell, drop: 2 },
		{ key: 'comment', title: T[9], hint: L[9], width: 'minmax(110px, 1.4fr)', render: commentCell, drop: 1 }
	]);

	function link(e: MouseEvent) {
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) e.stopPropagation();
		else e.preventDefault();
	}
	const tone = (s: OrganizationLicense['transfer_status']) => (s ? (TRANSFER_STATUS_SCHEMES[s] ?? 'neutral') : 'neutral');
</script>

{#snippet orgCell(row: OrganizationLicense)}
	<TableCell><a href="/organizations/{row.organization_id}?tab=licenses" class="truncate font-medium text-fg" title={row.organization_name ?? undefined} onclick={link}>{licenseOrgTitle(row)}</a></TableCell>
{/snippet}
{#snippet vendorCell(row: OrganizationLicense)}<TableCell><span class="truncate" title={row.vendor}>{shortVendor(row.vendor)}</span></TableCell>{/snippet}
{#snippet productCell(row: OrganizationLicense)}<TableCell><span class="truncate" title={row.product_name}>{row.product_name}</span></TableCell>{/snippet}
{#snippet contractCell(row: OrganizationLicense)}<TableCell><span class="truncate whitespace-nowrap" title={row.contract_number ?? undefined}>{row.contract_number || dash}</span></TableCell>{/snippet}
{#snippet signedCell(row: OrganizationLicense)}<TableCell><span class="whitespace-nowrap">{licenseSignedText(row)}</span></TableCell>{/snippet}
{#snippet termCell(row: OrganizationLicense)}
	{@const t = licenseTermInfo(row, now)}
	<TableCell>
		<span class="whitespace-nowrap" title={t.hint}>{t.text}</span>
		{#if t.badge}<StatusChip label={t.badge} tone={t.tone === 'error' ? 'error' : 'warning'} />{/if}
	</TableCell>
{/snippet}
{#snippet statusCell(row: OrganizationLicense)}<TableCell><StatusChip label={transferStatusLabel(row.transfer_status)} tone={tone(row.transfer_status)} /></TableCell>{/snippet}
{#snippet managerCell(row: OrganizationLicense)}<TableCell><span class="truncate" title={row.manager_full_name ?? undefined}>{row.manager_full_name || dash}</span></TableCell>{/snippet}
{#snippet respCell(row: OrganizationLicense)}<TableCell><span class="truncate" title={row.responsible_contacts ?? undefined}>{row.responsible_contacts || dash}</span></TableCell>{/snippet}
{#snippet commentCell(row: OrganizationLicense)}<TableCell><span class="truncate" title={row.comment ?? undefined}>{row.comment || dash}</span></TableCell>{/snippet}

{#snippet field(label: string, value: string | null | undefined, multiline = false)}
	<div class="grid grid-cols-[9.5rem_minmax(0,1fr)] items-baseline gap-x-3">
		<span class="t-desc-l text-muted">{label}</span>
		<span class={['t-desc-l min-w-0 wrap-anywhere', multiline && 'line-clamp-2']}>{value || dash}</span>
	</div>
{/snippet}

{#snippet card(row: OrganizationLicense)}
	{@const t = licenseTermInfo(row, now)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2">
			<span class="t-row-strong break-words">{row.vendor} · {row.product_name}</span>
			<StatusChip label={transferStatusLabel(row.transfer_status)} tone={tone(row.transfer_status)} />
		</div>
		{#if showOrganization}
			<div class="grid grid-cols-[9.5rem_minmax(0,1fr)] items-baseline gap-x-3">
				<span class="t-desc-l text-muted">{L[0]}</span>
				<a href="/organizations/{row.organization_id}?tab=licenses" class="relative t-desc-l min-w-0 wrap-anywhere text-fg after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-['']" onclick={link}>{licenseOrgTitle(row)}</a>
			</div>
		{/if}
		{@render field(L[3], row.contract_number)}
		{@render field(L[4], licenseSignedText(row))}
		<div class="grid grid-cols-[9.5rem_minmax(0,1fr)] items-baseline gap-x-3">
			<span class="t-desc-l text-muted">{L[5]}</span>
			<span class="t-desc-l flex min-w-0 flex-wrap items-center gap-2" title={t.hint}>{t.text}{#if t.badge}<StatusChip label={t.badge} tone={t.tone === 'error' ? 'error' : 'warning'} />{/if}</span>
		</div>
		{@render field(L[7], row.manager_full_name)}
		{@render field(L[8], row.responsible_contacts)}
		{@render field(L[9], row.comment, true)}
	</div>
{/snippet}

<DataTable {id} {rows} {columns} {card} {fill} {loading} {error} {onRetry} {onRowClick} {total} {hasMore} {loadingMore} {onLoadMore} {empty} {embedded} emptyText="Лицензий пока нет" ariaLabel="Лицензии" />
