<script lang="ts">
	// Реестр ЕГРЮЛ (админ): текущая версия, загрузка новой выгрузки, история версий. Пока идёт разбор, список обновляется сам.
	import { onDestroy, onMount } from 'svelte';
	import { Trash, Upload } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { Btn, confirm, CopyButton, DataTable, DateText, EmptyState, ErrorState, FilterBar, IconBtn, Notice, Page, PageHeader, StatusChip, TableCell, toast, type Col } from '$lib/ui';
	import { people } from '$lib/api/people.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import UserName from '$lib/ui/UserName.svelte';
	import { ApiError } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { formatDate, formatNumber } from '$lib/utils/format';
	import { REGISTRY_SOURCES, REGISTRY_STATUSES, isRegistryBusy, labelOf } from '../labels';
	import type { RegistryVersion } from '../types';
	import { createPoller } from '../shared/polling.svelte';
	import { registryVersionHint } from '../hints';
	import UploadRegistryDrawer from './UploadRegistryDrawer.svelte';

	const pager = createPager<RegistryVersion>((cursor, signal) => unwrap(api.GET('/api/admin/registry/versions', { params: { query: { limit: 50, cursor } }, signal })).then((r) => ({ items: r.items ?? [], next_cursor: r.next_cursor })));
	const poller = createPoller(
		async () => {
			await pager.reload();
			return pager.items.some((v) => isRegistryBusy(v.status));
		},
		{ interval: 3000 }
	);
	onMount(async () => {
		await pager.reload();
		if (pager.items.some((v) => isRegistryBusy(v.status))) poller.start();
	});
	onDestroy(() => poller.stop());

	const allowed = $derived(session.can('registry:import'));

	// the journal has no server-side search: the search looks through the versions that are loaded (source, status, who, checksum)
	const q = $derived(readQuery('q').trim().toLowerCase());
	$effect(() => people.ensure(pager.items.map((v) => v.imported_by)));
	const rows = $derived(
		q ? pager.items.filter((v) => [labelOf(REGISTRY_SOURCES, v.source), labelOf(REGISTRY_STATUSES, v.status), people.name(v.imported_by, ''), v.checksum ?? ''].some((text) => text.toLowerCase().includes(q))) : pager.items
	);
	const busy = $derived(pager.items.some((v) => isRegistryBusy(v.status)));
	const current = $derived(pager.items.find((v) => v.status === 'completed') ?? null);
	let uploading = $state(false);

	const tone = (s: string) => (s === 'completed' ? 'success' : s === 'failed' ? 'error' : s === 'running' ? 'info' : 'neutral');

	/** Удаление — только ADMIN (доступ к странице пошире, `registry:import`); сервер и так откажет (409 CRM-1303)
	 * на текущей версии и на той, что сейчас разбирается — кнопку для них тоже прячем заранее. */
	const canRemove = (v: RegistryVersion) => session.isRole('ADMIN') && !isRegistryBusy(v.status) && v.id !== current?.id;

	async function remove(v: RegistryVersion) {
		if (!(await confirm({ title: `Удалить версию «${labelOf(REGISTRY_SOURCES, v.source)}» от ${formatDate(v.imported_at ?? v.created_at)}?`, confirmLabel: 'Удалить', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/admin/registry/versions/{version_id}', { params: { path: { version_id: v.id } } }));
			toast.success('Версия удалена');
			await pager.reload();
		} catch (e) {
			toast.error(e);
		}
	}

	const columns: Col<RegistryVersion>[] = [
		{ key: 'source', title: 'Источник', width: 'minmax(160px, 1fr)', render: sourceCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'entries', title: 'Записей', align: 'right', render: entriesCell },
		{ key: 'when', title: 'Загружена', render: whenCell },
		{ key: 'by', title: 'Кто', width: 'minmax(120px, 1fr)', drop: 2, render: byCell },
		{ key: 'sum', title: 'Контрольная сумма', drop: 1, render: sumCell },
		{ key: 'delete', title: '', width: 56, render: deleteCell }
	];
</script>

{#snippet sourceCell(v: RegistryVersion)}
	<TableCell>
		<span class="flex min-w-0 flex-col">
			<span class="t-body-m-strong">{labelOf(REGISTRY_SOURCES, v.source)}</span>
			{#if v.error}<span class="t-desc-m line-clamp-2 text-danger" title={v.error}>{v.error}</span>{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet statusCell(v: RegistryVersion)}<TableCell><StatusChip label={labelOf(REGISTRY_STATUSES, v.status)} tone={tone(v.status)} hint={registryVersionHint(v.status)} /></TableCell>{/snippet}
{#snippet entriesCell(v: RegistryVersion)}<TableCell align="right"><span class="t-body-s tabular-nums">{v.status === 'completed' ? formatNumber(v.entries_count) : '—'}</span></TableCell>{/snippet}
{#snippet whenCell(v: RegistryVersion)}<TableCell><span class="t-body-s"><DateText value={v.imported_at ?? v.created_at} time /></span></TableCell>{/snippet}
{#snippet byCell(v: RegistryVersion)}<TableCell><span class="t-body-s"><UserName id={v.imported_by} /></span></TableCell>{/snippet}
{#snippet sumCell(v: RegistryVersion)}
	<TableCell>
		{#if v.checksum}<span class="flex items-center gap-1"><span class="t-desc-l font-mono text-muted">{v.checksum.slice(0, 12)}…</span><CopyButton value={v.checksum} label="Скопировать контрольную сумму" /></span>{:else}<span class="text-soft">—</span>{/if}
	</TableCell>
{/snippet}
{#snippet deleteCell(v: RegistryVersion)}<TableCell>{#if canRemove(v)}<IconBtn icon={Trash} label="Удалить версию" danger onclick={() => remove(v)} />{/if}</TableCell>{/snippet}

{#snippet card(v: RegistryVersion)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2">
			<span class="t-body-m-strong">{labelOf(REGISTRY_SOURCES, v.source)}</span>
			<StatusChip label={labelOf(REGISTRY_STATUSES, v.status)} tone={tone(v.status)} hint={registryVersionHint(v.status)} />
		</div>
		<span class="t-desc-l text-muted"><DateText value={v.imported_at ?? v.created_at} time />{v.status === 'completed' ? ` · ${formatNumber(v.entries_count)} записей` : ''}</span>
		{#if v.error}<span class="t-desc-l text-danger wrap-anywhere">{v.error}</span>{/if}
	</div>
{/snippet}

<Page>
	<PageHeader title="Реестр ЕГРЮЛ" />

	{#if !allowed}
		<ErrorState error={new ApiError({ status: 403, detail: 'Реестр ЕГРЮЛ доступен администратору.' })} />
	{:else}
		<FilterBar search={readQuery('q')} placeholder="Источник, статус, кто или контрольная сумма" onSearch={(v) => setQuery({ q: v || null })} primary={{ label: 'Загрузить выгрузку', icon: Upload, disabled: busy, onclick: () => (uploading = true) }} />
		{#if busy}<Notice class="shrink-0" tone="info">Идёт разбор выгрузки — новую можно загрузить после завершения.</Notice>{/if}
		{#if current}
			<section class="flex flex-col gap-0.5 rounded-lg border border-line bg-surface px-4 py-3" aria-label="Текущая версия">
				<span class="t-desc-l text-muted">Текущая версия</span>
				<span class="t-body-l-strong">{labelOf(REGISTRY_SOURCES, current.source)} · <DateText value={current.imported_at ?? current.created_at} /> · {formatNumber(current.entries_count)} записей</span>
			</section>
		{/if}
		<DataTable
			{rows}
			{columns}
			{card}
			loading={pager.loading}
			error={pager.error}
			onRetry={() => pager.reload()}
			hasMore={pager.hasMore}
			loadingMore={pager.loadingMore}
			onLoadMore={() => pager.loadMore()}
			ariaLabel="Версии реестра"
		>
			{#snippet empty()}
				{#if q}
					<EmptyState title="Ничего не найдено" compact />
				{:else}
					<EmptyState title="Реестр не загружен" hint="Автоподстановка по ИНН заработает после первой выгрузки ФНС.">
						{#snippet action()}<Btn label="Загрузить выгрузку" icon={Upload} variant="outline" colorScheme="neutral" onclick={() => (uploading = true)} />{/snippet}
					</EmptyState>
				{/if}
			{/snippet}
		</DataTable>
	{/if}
</Page>

<UploadRegistryDrawer
	open={uploading}
	onClose={() => (uploading = false)}
	onStarted={async () => {
		await pager.reload();
		poller.start();
	}}
/>
