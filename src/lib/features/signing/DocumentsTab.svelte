<script lang="ts">
	// «Документы»: те, что создавали в этом браузере, где я подписант, а для ролей с правом аудита — ещё и по журналу.
	// Списка документов у бэкенда нет (C-5), поэтому раздел честно называет источник, а не обещает «все».
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ArrowRight } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import DataTable, { type Col } from '$lib/ui/DataTable.svelte';
	import TableCell from '$lib/ui/TableCell.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { myRequests } from './api';
	import { fetchDocuments, knownDocumentIds } from './known';
	import { docStatusMeta, docTypeLabel, signerProgress } from './status';
	import type { SignatureDocument } from './types';

	let docs = $state<SignatureDocument[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			const ids = new Set(knownDocumentIds());
			const sources: Promise<void>[] = [
				myRequests().then((list) => list.forEach((r) => ids.add(r.document_id))).catch(() => {})
			];
			if (session.can('audit:read')) {
				sources.push(
					unwrap(api.GET('/api/admin/audit', { params: { query: { action: 'SIGNATURE_DOCUMENT_CREATED', limit: 50 } } }))
						.then((page) => page.items.forEach((e) => e.entity_id && ids.add(e.entity_id)))
						.catch(() => {})
				);
			}
			await Promise.all(sources);
			docs = (await fetchDocuments([...ids].slice(0, 60))).sort((a, b) => b.created_at.localeCompare(a.created_at));
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	const open = (doc: SignatureDocument) => goto(`/signing/${doc.id}`);
	const progress = (doc: SignatureDocument) => signerProgress((doc.requests ?? []).map((r) => ({ sign_order: r.sign_order, status: r.status })));

	const columns: Col<SignatureDocument>[] = [
		{ key: 'title', title: 'Документ', width: 'minmax(220px, 3fr)', render: title },
		{ key: 'status', title: 'Статус', render: status },
		{ key: 'signed', title: 'Подписи', drop: 2, render: signed },
		{ key: 'deadline', title: 'Срок', drop: 1, render: deadline },
		{ key: 'go', title: '', align: 'right', render: go }
	];
</script>

{#snippet title(doc: SignatureDocument)}
	<TableCell>
		<span class="flex min-w-0 flex-col py-1.5">
			<span class="t-body-m-strong block truncate">{doc.title}</span>
			<span class="t-desc-l block truncate text-muted">{docTypeLabel(doc.doc_type)}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet status(doc: SignatureDocument)}
	<TableCell>
		{@const meta = docStatusMeta(doc.status)}
		<StatusChip label={meta.label} tone={meta.tone} />
	</TableCell>
{/snippet}
{#snippet signed(doc: SignatureDocument)}
	<TableCell>
		{@const p = progress(doc)}
		<span class="tabular-nums">{p.signed} из {p.total}</span>
	</TableCell>
{/snippet}
{#snippet deadline(doc: SignatureDocument)}
	<TableCell>
		{#if doc.deadline_at && !docStatusMeta(doc.status).terminal}<DateText value={doc.deadline_at} />{:else}<span class="text-muted">—</span>{/if}
	</TableCell>
{/snippet}
{#snippet go(doc: SignatureDocument)}
	<TableCell align="right">
		<IconBtn icon={ArrowRight} label="Открыть" size="s" onclick={() => open(doc)} />
	</TableCell>
{/snippet}
{#snippet card(doc: SignatureDocument)}
	{@const p = progress(doc)}
	<div class="flex flex-col gap-2 p-1">
		<div class="flex items-start gap-2">
			<span class="t-body-m-strong min-w-0 flex-1 break-words">{doc.title}</span>
			{@render status(doc)}
		</div>
		<span class="t-desc-l text-muted">{docTypeLabel(doc.doc_type)} · подписали {p.signed} из {p.total}</span>
	</div>
{/snippet}

<DataTable id="signing-docs" rows={docs} {columns} {card} {loading} {error} onRetry={load} onRowClick={open} emptyText="Документов пока нет" ariaLabel="Документы" />
