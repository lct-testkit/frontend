<script lang="ts">
	// Карточка документа на подпись (сюда ведут уведомления `signature_document`): подписанты, хэш, хронология, действия.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DocumentPanel from '$lib/features/signing/DocumentPanel.svelte';
	import { fetchDocument } from '$lib/features/signing/known';
	import type { SignatureDocument } from '$lib/features/signing/types';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import { api, unwrap } from '$lib/api';

	const id = $derived(page.params.id ?? '');
	let doc = $state<SignatureDocument | null>(null);
	let loading = $state(true);
	let error = $state<unknown>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			// напрямую: ошибку (403/404) нужно показать, а не превратить в «нет документа»
			doc = await unwrap(api.GET('/api/signature-documents/{document_id}', { params: { path: { document_id: id } } }));
			void fetchDocument(id);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void id;
		void load();
	});
</script>

<svelte:head><title>{doc?.title ?? 'Документ'} · RTK School</title></svelte:head>

<Page narrow>
	<PageHeader title={doc?.title ?? 'Документ на подпись'} back="/signing" />
	{#if loading}
		<Skeleton kind="lines" rows={4} />
	{:else if error}
		<ErrorState {error} onRetry={load} />
	{:else if doc}
		<DocumentPanel {doc} onChange={(next) => (doc = next)} onRecreate={() => goto(`/deals/${doc?.entity_id}`)} />
	{/if}
</Page>
