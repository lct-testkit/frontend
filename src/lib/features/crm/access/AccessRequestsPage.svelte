<script lang="ts">
	// Запросы доступа к чужому вузу. «Входящие» — то, что решает пользователь (владелец вуза, руководитель его команды, администратор):
	// одобрить на срок, отклонить с причиной, снять выданный доступ. «Мои запросы» — то, что отправил он сам: можно отменить, пока ждёт.
	// Название вуза видно только тем, кому он доступен: в своём ещё не одобренном запросе его нет.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CheckLarge, CloseLarge, Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { people } from '$lib/api/people.svelte';
	import { Btn, DataTable, DateText, FilterBar, IconBtn, Page, PageHeader, Pick, StatusChip, TabsBar, TableCell, UserName, confirm, toast, type Col } from '$lib/ui';
	import { formatDate } from '$lib/utils/format';
	import { orgCache, orgTitle } from '../shared/entityCache.svelte';
	import type { AccessRequest } from '../types';
	import AccessDecisionModal from './AccessDecisionModal.svelte';
	import { accessInbox } from './inbox.svelte';
	import { REQUEST_STATUS_FILTERS, accessUntil, effectiveStatus, matchesStatus, requestActions, statusMeta } from './accessRequests';

	const BOXES = [
		{ key: 'inbox', label: 'Входящие' },
		{ key: 'mine', label: 'Мои запросы' }
	];
	const box = $derived((page.url.searchParams.get('box') === 'mine' ? 'mine' : 'inbox') as 'inbox' | 'mine');
	const statusKey = $derived(REQUEST_STATUS_FILTERS.find((f) => f.key === page.url.searchParams.get('status'))?.key ?? 'pending');

	const pager = createPager<AccessRequest>(async (cursor, signal) =>
		unwrap(api.GET('/api/access-requests', { params: { query: { box, status: statusKey === 'all' ? undefined : statusKey, limit: 50, cursor: cursor ?? undefined } }, signal })).then((res) => ({ ...res, items: res.items.filter((r) => matchesStatus(r, statusKey)) }))
	);
	$effect(() => {
		void box;
		void statusKey;
		void pager.reload();
	});
	onMount(() => () => pager.abort());
	// названия вузов и имена просящих догружаются по мере появления строк
	$effect(() => {
		orgCache.ensure(pager.items.map((r) => r.entity_id));
		people.ensure(pager.items.flatMap((r) => [r.requester_id, r.decided_by]));
	});

	const setQuery = (patch: Record<string, string>) => {
		const q = new URLSearchParams(page.url.searchParams);
		for (const [k, v] of Object.entries(patch)) q.set(k, v);
		void goto(`?${q}`, { replaceState: true, keepFocus: true, noScroll: true });
	};

	let deciding = $state<{ request: AccessRequest; mode: 'approve' | 'reject' } | null>(null);
	let busy = $state<string | null>(null);

	// строка остаётся с новым статусом, пока список не перечитают
	const replace = (next: AccessRequest) => {
		pager.patch((r) => r.id === next.id, next);
		void accessInbox.refresh();
	};

	async function act(r: AccessRequest, kind: 'cancel' | 'revoke') {
		const ok = await confirm(
			kind === 'cancel'
				? { title: 'Отменить запрос?', message: 'Ответственный за вуз его не увидит.', confirmLabel: 'Отменить запрос', cancelLabel: 'Не отменять' }
				: { title: 'Снять доступ?', message: 'Вуз сразу пропадёт из списка просившего.', confirmLabel: 'Снять доступ', danger: true }
		);
		if (!ok) return;
		busy = r.id;
		try {
			const path = { request_id: r.id };
			replace(await unwrap(kind === 'cancel' ? api.POST('/api/access-requests/{request_id}/cancel', { params: { path } }) : api.POST('/api/access-requests/{request_id}/revoke', { params: { path } })));
			toast.success(kind === 'cancel' ? 'Запрос отменён' : 'Доступ снят');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}

	const columns = $derived<Col<AccessRequest>[]>([
		{ key: 'org', title: 'Вуз', width: 'minmax(180px, 1.5fr)', render: orgCell },
		...(box === 'inbox' ? [{ key: 'requester', title: 'Кто просит', width: 'minmax(200px, 1fr)', drop: 3, render: whoCell }] : []),
		{ key: 'reason', title: 'Причина', width: 'minmax(180px, 2fr)', drop: 2, render: reasonCell },
		{ key: 'created', title: 'Отправлен', drop: 1, render: dateCell },
		{ key: 'status', title: 'Статус', width: 'minmax(250px, 0.8fr)', render: statusCell },
		{ key: 'actions', title: '', align: 'right', render: actionCell }
	]);
</script>

{#snippet orgLink(r: AccessRequest)}
	{@const org = orgCache.get(r.entity_id)}
	{#if org}
		<a href="/organizations/{r.entity_id}" class="truncate font-medium text-fg" title={orgTitle(org)}>{orgTitle(org)}</a>
	{:else if org === undefined}
		<span class="inline-block min-w-24 animate-pulse text-muted">…</span>
	{:else}
		<span class="truncate text-muted" title="Название скрыто, пока доступ не выдан">Вуз, название скрыто</span>
	{/if}
{/snippet}
{#snippet orgCell(r: AccessRequest)}<TableCell>{@render orgLink(r)}</TableCell>{/snippet}
{#snippet whoCell(r: AccessRequest)}<TableCell><span class="truncate"><UserName id={r.requester_id} /></span></TableCell>{/snippet}
{#snippet reasonCell(r: AccessRequest)}<TableCell><span class="truncate" title={r.reason}>{r.reason}</span></TableCell>{/snippet}
{#snippet dateCell(r: AccessRequest)}<TableCell><span class="whitespace-nowrap"><DateText value={r.created_at} relative /></span></TableCell>{/snippet}
{#snippet statusBlock(r: AccessRequest)}
	{@const status = effectiveStatus(r)}
	{@const meta = statusMeta(status)}
	{@const until = accessUntil(r, formatDate)}
	<StatusChip label={meta.label} tone={meta.tone} hint={meta.hint} />
	{#if until}<span class="t-desc-l whitespace-nowrap text-muted">{until}</span>{/if}
	{#if r.decision_comment && status !== 'pending'}<span class="t-desc-l min-w-0 truncate text-muted" title={r.decision_comment}>{r.decision_comment}</span>{/if}
{/snippet}
{#snippet statusCell(r: AccessRequest)}<TableCell>{@render statusBlock(r)}</TableCell>{/snippet}
{#snippet buttons(r: AccessRequest)}
	{@const a = requestActions(r, box)}
	<span class="flex items-center justify-end gap-1 max-md:justify-start">
		{#if a.decide}
			<Btn label="Одобрить" size="s" icon={CheckLarge} onclick={() => (deciding = { request: r, mode: 'approve' })} />
			<Btn label="Отклонить" size="s" variant="outline" colorScheme="neutral" icon={CloseLarge} onclick={() => (deciding = { request: r, mode: 'reject' })} />
		{/if}
		{#if a.revoke}<Btn label="Снять доступ" size="s" variant="outline" colorScheme="neutral" loading={busy === r.id} onclick={() => act(r, 'revoke')} />{/if}
		{#if a.cancel}<Btn label="Отменить" size="s" variant="outline" colorScheme="neutral" loading={busy === r.id} onclick={() => act(r, 'cancel')} />{/if}
		{#if a.open && box === 'mine'}<Btn label="Открыть вуз" size="s" variant="outline" colorScheme="neutral" onclick={() => goto(`/organizations/${r.entity_id}`)} />{/if}
	</span>
{/snippet}
{#snippet actionCell(r: AccessRequest)}<TableCell align="right">{@render buttons(r)}</TableCell>{/snippet}
{#snippet card(r: AccessRequest)}
	<div class="flex min-w-0 flex-col gap-2">
		<div class="flex min-w-0 flex-col gap-1">{@render orgLink(r)}</div>
		<p class="t-desc-l m-0 break-words">{r.reason}</p>
		<div class="flex flex-wrap items-center gap-2">{@render statusBlock(r)}</div>
		<span class="t-desc-m text-soft">
			{#if box === 'inbox'}<UserName id={r.requester_id} /> · {/if}<DateText value={r.created_at} relative />
		</span>
		{@render buttons(r)}
	</div>
{/snippet}

<svelte:head><title>Доступ к вузам · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Доступ к вузам">
		{#snippet tabs(underline)}
			<TabsBar items={BOXES} value={box} label="Входящие и мои запросы" {underline} onChange={(key) => setQuery({ box: key })} />
		{/snippet}
		{#snippet actions()}<IconBtn icon={Refresh} label="Обновить" onclick={() => pager.reload()} />{/snippet}
	</PageHeader>

	<FilterBar active={statusKey === 'pending' ? 0 : 1} onReset={() => setQuery({ status: 'pending' })}>
		{#snippet filters()}
			<Pick label="Статус" value={statusKey} items={REQUEST_STATUS_FILTERS} onChange={(v) => setQuery({ status: v ?? 'pending' })} />
		{/snippet}
	</FilterBar>

	<DataTable
		rows={pager.items}
		{columns}
		{card}
		loading={pager.loading}
		error={pager.error}
		onRetry={() => pager.reload()}
		hasMore={pager.hasMore}
		loadingMore={pager.loadingMore}
		onLoadMore={() => pager.loadMore()}
		emptyText={box === 'inbox' ? (statusKey === 'pending' ? 'Запросов на решение нет' : 'Запросов нет') : statusKey === 'pending' ? 'Ожидающих запросов нет' : 'Запросов нет'}
		ariaLabel={box === 'inbox' ? 'Входящие запросы доступа' : 'Мои запросы доступа'}
	/>
</Page>

<AccessDecisionModal
	open={deciding !== null}
	request={deciding?.request ?? null}
	mode={deciding?.mode ?? 'approve'}
	onClose={() => (deciding = null)}
	onDone={(r) => {
		replace(r);
		deciding = null;
	}}
/>
