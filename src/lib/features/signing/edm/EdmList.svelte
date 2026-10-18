<script lang="ts" module>
	export const STATE_TABS = [
		{ key: 'all', label: 'Все' },
		{ key: 'active', label: 'Действуют' },
		{ key: 'expired', label: 'Истекли' },
		{ key: 'revoked', label: 'Отозваны' }
	] as const;
	/** the tab that is on: the value of `?state=` (unknown or missing = «Все») */
	export function stateTab(raw: string): string {
		return STATE_TABS.find((t) => t.key === raw)?.key ?? 'all';
	}
</script>

<script lang="ts">
	// Соглашения об ЭДО (dop.md §10.1): без действующего соглашения внешняя подпись блокируется.
	// Курсорная пагинация (limit/cursor, «Показать ещё» и догрузка у конца списка); сторона приходит готовой в `party_display`, имя по id — запасной путь.
	// Тип стороны фильтруется на сервере, состояние — на клиенте (по загруженным строкам), потому что «истекло» вытекает из дат.
	import { onMount } from 'svelte';
	import { CloseLarge, DocumentDownload } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { ensureSubjects, subjectName } from '$lib/features/identity/erasure/subject';
	import ReasonModal from '$lib/features/identity/ReasonModal.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { FilterBar, IconBtn, DataTable, StatusChip, toast, type Col, TableCell } from '$lib/ui';
	import { formatDate } from '$lib/utils/format';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { edmMethodLabel, edmPartyLabel, edmState, edmStateMeta } from '../status';
	import { EDM_STATE_HINTS } from '../hints';
	import type { EdmAgreement } from '../types';

	// what the state means, plus why it was revoked
	const edmHint = (a: EdmAgreement): string => `${EDM_STATE_HINTS[edmState(a)]}${a.revoke_reason ? ` Причина отзыва: ${a.revoke_reason}.` : ''}`;

	const PARTIES = (['organization', 'contact', 'user'] as const).map((k) => ({ key: k, value: edmPartyLabel(k) }));

	const tab = $derived(stateTab(readQuery('state')));
	const stateFilter = $derived(tab === 'all' ? '' : tab);
	const partyType = $derived(readQuery('party_type'));
	const canAdmin = $derived(session.can('edm:admin'));

	const pager = createPager<EdmAgreement>(async (cursor, signal) => {
		const res = await unwrap(api.GET('/api/admin/edm-agreements', { params: { query: { party_type: partyType || undefined, limit: 50, cursor: cursor ?? undefined } }, signal }));
		// имя стороны приходит в party_display; по id догружаем только то, что сервер не назвал
		ensureSubjects(res.items.filter((a) => !a.party_display).map((a) => ({ subject_type: a.party_type, subject_id: a.party_id })));
		return res;
	});
	$effect(() => {
		void partyType;
		void pager.reload();
	});
	onMount(() => () => pager.abort());

	const partyName = (a: EdmAgreement): string => a.party_display || subjectName(a.party_type, a.party_id);

	const rows = $derived(stateFilter ? pager.items.filter((a) => edmState(a) === stateFilter || (stateFilter === 'active' && edmState(a) === 'upcoming')) : pager.items);

	export function reload() {
		void pager.reload();
	}
	/** только что оформленное соглашение — сразу наверх, без повторного запроса */
	export function add(agreement: EdmAgreement) {
		pager.prepend(agreement);
		if (!agreement.party_display) ensureSubjects([{ subject_type: agreement.party_type, subject_id: agreement.party_id }]);
	}

	let revoking = $state<EdmAgreement | null>(null);

	async function revoke(reason: string) {
		if (!revoking) return;
		const next = await unwrap(api.POST('/api/admin/edm-agreements/{agreement_id}/revoke', { params: { path: { agreement_id: revoking.id } }, body: { reason } }));
		pager.patch((a) => a.id === next.id, next);
		revoking = null;
		toast.success('Соглашение отозвано', 'Внешняя подпись по нему больше не пройдёт');
	}

	async function download(a: EdmAgreement) {
		if (!a.agreement_file_id) return;
		try {
			const res = await unwrap(api.GET('/api/files/{file_id}/download-url', { params: { path: { file_id: a.agreement_file_id }, query: { entity_type: 'edm_agreement', entity_id: a.id } } }));
			window.open(res.download_url, '_blank', 'noopener');
		} catch (e) {
			toast.error(e);
		}
	}

	function term(a: EdmAgreement): string {
		if (a.valid_from && a.valid_to) return `${formatDate(a.valid_from)} — ${formatDate(a.valid_to)}`;
		if (a.valid_to) return `до ${formatDate(a.valid_to)}`;
		if (a.valid_from) return `с ${formatDate(a.valid_from)}, бессрочно`;
		return 'Бессрочно';
	}
	const canRevoke = (a: EdmAgreement) => canAdmin && ['active', 'upcoming'].includes(edmState(a));

	const columns: Col<EdmAgreement>[] = [
		{ key: 'party', title: 'Сторона', width: 'minmax(180px, 2fr)', render: party },
		{ key: 'number', title: 'Номер и способ', width: 'minmax(150px, 1.2fr)', drop: 2, render: numberCell },
		{ key: 'term', title: 'Срок', width: 'minmax(170px, 1.2fr)', drop: 1, render: termCell },
		{ key: 'state', title: 'Состояние', render: stateCell },
		{ key: 'actions', title: '', align: 'right', render: actionsCell }
	];
</script>

{#snippet party(a: EdmAgreement)}
	<TableCell>
		<span class="flex min-w-0 flex-col py-2">
			<span class="t-body-s-strong truncate">{partyName(a)}</span>
			<span class="t-desc-m truncate text-muted">{edmPartyLabel(a.party_type)}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet numberCell(a: EdmAgreement)}
	<TableCell>
		<span class="flex min-w-0 flex-col py-2">
			<span class="t-body-s truncate">{a.agreement_number ? `№ ${a.agreement_number}` : 'Без номера'}</span>
			<span class="t-desc-m truncate text-muted">{edmMethodLabel(a.conclusion_method)}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet termCell(a: EdmAgreement)}<TableCell><span class="block truncate py-2 text-muted" title={a.revoke_reason ? `Отозвано: ${a.revoke_reason}` : undefined}>{term(a)}</span></TableCell>{/snippet}
{#snippet stateCell(a: EdmAgreement)}
	<TableCell>
		{@const meta = edmStateMeta(edmState(a))}
		<span class="block py-2"><StatusChip label={meta.label} tone={meta.tone} hint={edmHint(a)} /></span>
	</TableCell>
{/snippet}
{#snippet actionButtons(a: EdmAgreement)}
	<span class="flex items-center justify-end gap-1">
		{#if a.agreement_file_id && canAdmin}<IconBtn icon={DocumentDownload} label="Скачать файл соглашения" size="s" onclick={() => download(a)} />{/if}
		{#if canRevoke(a)}<IconBtn icon={CloseLarge} label="Отозвать соглашение" danger size="s" onclick={() => (revoking = a)} />{/if}
	</span>
{/snippet}
{#snippet actionsCell(a: EdmAgreement)}<TableCell align="right">{@render actionButtons(a)}</TableCell>{/snippet}
{#snippet card(a: EdmAgreement)}
	{@const meta = edmStateMeta(edmState(a))}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-start justify-between gap-2">
			<span class="t-body-s-strong min-w-0 wrap-anywhere">{partyName(a)}</span>
			<StatusChip label={meta.label} tone={meta.tone} hint={edmHint(a)} />
		</div>
		<span class="t-desc-l text-muted">{edmPartyLabel(a.party_type)} · {edmMethodLabel(a.conclusion_method)}{a.agreement_number ? ` · № ${a.agreement_number}` : ''}</span>
		<span class="t-desc-l">{term(a)}</span>
		{#if a.revoke_reason}<span class="t-desc-m text-muted">Причина отзыва: {a.revoke_reason}</span>{/if}
		{@render actionButtons(a)}
	</div>
{/snippet}

{#snippet filters()}
	<Pick label="Сторона" items={PARTIES} value={partyType || null} clearable placeholder="Любая" onChange={(v) => void setQuery({ party_type: v })} />
{/snippet}

<FilterBar active={partyType ? 1 : 0} onReset={() => void setQuery({ party_type: '' })} {filters} />
<DataTable
	id="admin-edm"
	{rows}
	{columns}
	{card}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	emptyText={stateFilter || partyType ? 'Соглашений с такими условиями нет' : 'Соглашений об ЭДО пока нет'}
	ariaLabel="Соглашения об ЭДО"
/>

<ReasonModal
	open={revoking !== null}
	title="Отозвать соглашение"
	confirmLabel="Отозвать"
	danger
	note="Пока нет другого действующего соглашения, внешняя подпись для этой стороны будет заблокирована."
	label="Причина отзыва"
	onSubmit={revoke}
	onClose={() => (revoking = null)}
/>
