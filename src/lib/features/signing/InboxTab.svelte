<script lang="ts">
	// «Мне на подпись»: запросы подписи текущего сотрудника (название и срок документа приходят в самом запросе).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { ArrowRight } from '@lct-testkit/rt-ui/icons';
	import DateText from '$lib/ui/DateText.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import DataTable, { type Col } from '$lib/ui/DataTable.svelte';
	import TableCell from '$lib/ui/TableCell.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { myRequests } from './api';
	import { isRequestOpen, requestStatusMeta } from './status';
	import type { SignatureRequest } from './types';

	let { scope, onScope }: { scope: 'open' | 'all'; onScope: (next: 'open' | 'all') => void } = $props();

	let requests = $state<SignatureRequest[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			requests = await myRequests();
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	const actionable = (r: SignatureRequest) => r.status === 'sent' || r.status === 'viewed';
	const rows = $derived(
		requests
			.filter((r) => scope === 'all' || isRequestOpen(r.status))
			.sort((a, b) => Number(actionable(b)) - Number(actionable(a)) || b.created_at.localeCompare(a.created_at))
	);

	const open = (r: SignatureRequest) => goto(actionable(r) ? `/signing/requests/${r.id}` : `/signing/${r.document_id}`);
	const name = (r: SignatureRequest) => r.document_title || 'Документ на подпись';

	const columns: Col<SignatureRequest>[] = [
		{ key: 'title', title: 'Документ', width: 'minmax(220px, 3fr)', render: title },
		{ key: 'deadline', title: 'Срок', drop: 1, render: deadline },
		{ key: 'status', title: 'Статус', render: status },
		{ key: 'go', title: '', align: 'right', render: go }
	];
</script>

{#snippet title(r: SignatureRequest)}
	<TableCell>
		<span class="t-body-m-strong block min-w-0 truncate py-2">{name(r)}</span>
	</TableCell>
{/snippet}
{#snippet deadline(r: SignatureRequest)}
	<TableCell>
		{#if r.deadline_at && isRequestOpen(r.status)}<DateText value={r.deadline_at} />{:else}<span class="text-muted">—</span>{/if}
	</TableCell>
{/snippet}
{#snippet status(r: SignatureRequest)}
	<TableCell>
		{@const meta = requestStatusMeta(r.status)}
		<StatusChip label={meta.label} tone={meta.tone} />
	</TableCell>
{/snippet}
{#snippet go(r: SignatureRequest)}
	<TableCell align="right">
		<IconBtn icon={ArrowRight} label="Открыть" size="s" onclick={() => open(r)} />
	</TableCell>
{/snippet}
{#snippet card(r: SignatureRequest)}
	<div class="flex flex-col gap-2 p-1">
		<div class="flex items-start gap-2">
			<span class="t-body-m-strong min-w-0 flex-1 break-words">{name(r)}</span>
			{@render status(r)}
		</div>
		{#if r.deadline_at && isRequestOpen(r.status)}
			<span class="t-desc-l text-muted">Подписать до <DateText value={r.deadline_at} /></span>
		{/if}
	</div>
{/snippet}

<div class="self-start">
	<SegmentedControl value={scope} onChange={(v) => onScope(v as 'open' | 'all')} size="m">
		<Segment index="open" label="Ожидают" />
		<Segment index="all" label="Все" />
	</SegmentedControl>
</div>
<DataTable
	id="signing-inbox"
	{rows}
	{columns}
	{card}
	{loading}
	{error}
	onRetry={load}
	onRowClick={open}
	emptyText={scope === 'open' ? 'Нет документов, ожидающих вашей подписи' : 'Запросов на подпись пока не было'}
	ariaLabel="Мне на подпись"
/>
