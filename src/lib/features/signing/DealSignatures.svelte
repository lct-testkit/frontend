<script lang="ts">
	// Блок «Подписание» в карточке сделки: документы на подписи, подписанты, отправка и аннулирование.
	import { untrack } from 'svelte';
	import { Send } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { listDocuments } from './api';
	import DocumentPanel from './DocumentPanel.svelte';
	import { fetchDocument, putDocument } from './known';
	import SendWizard from './SendWizard.svelte';
	import SignLinkModal from './SignLinkModal.svelte';
	import { docStatusMeta } from './status';
	import { DOC_STATUS_HINTS } from './hints';
	import type { SignLink, SignatureDocument } from './types';

	let { dealId }: { dealId: string } = $props();

	let docs = $state<SignatureDocument[]>([]);
	let dealStatus = $state('none');
	let loading = $state(true);
	let error = $state<unknown>(null);
	let wizard = $state(false);
	let links = $state<SignLink[]>([]);
	let linksOpen = $state(false);

	const canCreate = $derived(session.can('signature:create'));
	const statusMeta = $derived(docStatusMeta(dealStatus));

	async function load() {
		loading = true;
		error = null;
		try {
			const [card, list] = await Promise.all([
				unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: dealId } } })),
				listDocuments('deal', dealId)
			]);
			dealStatus = card.deal.signature_status;
			docs = list.sort((a, b) => b.created_at.localeCompare(a.created_at));
			for (const doc of docs) putDocument(doc);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void dealId;
		untrack(() => void load());
	});

	function replace(next: SignatureDocument) {
		putDocument(next);
		docs = docs.map((d) => (d.id === next.id ? next : d));
		void refreshStatus();
	}

	/** статус сделки меняется вместе с документом (подписан/аннулирован) — перечитываем его отдельно */
	async function refreshStatus() {
		try {
			dealStatus = (await unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: dealId } } }))).deal.signature_status;
		} catch {
			// статус останется прежним до следующей загрузки
		}
	}

	async function created(doc: SignatureDocument) {
		wizard = false;
		putDocument(doc);
		const fresh = (doc.requests ?? []).filter((r) => r.sign_url).map((r) => ({ name: r.signer_name_snapshot, url: r.sign_url! }));
		if (doc.status === 'blocked_no_agreement') toast.warning('Нет соглашения об ЭДО', 'Оформите его и отправьте документ снова');
		else toast.success('Отправлено на подпись');
		docs = [doc, ...docs.filter((d) => d.id !== doc.id)];
		void refreshStatus();
		if (fresh.length) {
			links = fresh;
			linksOpen = true;
		}
		void fetchDocument(doc.id, true).then((d) => d && replace(d));
	}
</script>

<section class="flex flex-col gap-3" aria-label="Подписание" data-testid="deal-signatures">
	<div class="flex flex-wrap items-center gap-2">
		<h2 class="t-h4 m-0">Подписание</h2>
		{#if dealStatus !== 'none'}<StatusChip label={statusMeta.label} tone={statusMeta.tone} hint={DOC_STATUS_HINTS[dealStatus as keyof typeof DOC_STATUS_HINTS]} />{/if}
		{#if canCreate}
			<Btn class="ml-auto max-md:w-full" label="Отправить на подпись" icon={Send} size="auto" variant={docs.length ? 'secondary' : 'primary'} colorScheme={docs.length ? 'neutral' : 'accent'} onclick={() => (wizard = true)} data-testid="open-send-wizard" />
		{/if}
	</div>

	{#if loading}
		<div class="rounded-lg border border-line bg-surface p-4"><Skeleton kind="lines" rows={3} /></div>
	{:else if error}
		<ErrorState {error} onRetry={load} compact />
	{:else if docs.length === 0}
		<EmptyState compact title="Документов на подпись нет" />
	{:else}
		{#each docs as doc (doc.id)}
			<DocumentPanel {doc} compact onChange={replace} onRecreate={() => (wizard = true)} />
		{/each}
	{/if}
</section>

{#if canCreate}
	<SendWizard open={wizard} {dealId} onClose={() => (wizard = false)} onDone={created} />
{/if}
<SignLinkModal open={linksOpen} {links} onClose={() => (linksOpen = false)} />
