<script lang="ts">
	// События безопасности: неудачные входы, блокировки, неверные подписи вебхуков, массовые выгрузки. Только чтение и выгрузка NDJSON (право security_event:read).
	import { onMount } from 'svelte';
	import { Download } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap, ApiError, type components } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { apiQuery, describeFilters, exportFilename, readFilters } from '$lib/features/identity/security/security-query';
	import SecurityList from '$lib/features/identity/security/SecurityList.svelte';
	import SecuritySummary from '$lib/features/identity/security/SecuritySummary.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import { confirm } from '$lib/ui/confirm.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { readQuery } from '$lib/utils/query-state.svelte';

	const allowed = $derived(session.can('security_event:read'));
	let summary = $state<components['schemas']['SecurityEventSummaryOut'] | null>(null);
	let summaryError = $state(false);
	let exporting = $state(false);

	onMount(async () => {
		if (!session.can('security_event:read')) return;
		try {
			summary = await unwrap(api.GET('/api/admin/security-events/summary', { params: { query: { hours: 24 } } }));
		} catch {
			summaryError = true;
		}
	});

	async function exportNdjson() {
		const filters = readFilters(readQuery);
		const applied = describeFilters(filters, (id) => people.name(id));
		const ok = await confirm({
			title: 'Выгрузить события безопасности?',
			message: `Выгрузка до 10 000 записей${applied.length ? `, фильтры: ${applied.join('; ')}` : ' без фильтров'}. В журнал попадёт событие «Массовая выгрузка».`,
			confirmLabel: 'Выгрузить'
		});
		if (!ok) return;
		exporting = true;
		try {
			const { data, response } = await api.GET('/api/admin/security-events/export', { params: { query: { ...apiQuery(filters), limit: 10000 } }, parseAs: 'blob' });
			if (!response.ok || !data) throw new Error('Не удалось выгрузить события');
			const link = document.createElement('a');
			link.href = URL.createObjectURL(data as Blob);
			link.download = exportFilename();
			link.click();
			setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
			toast.success('Выгрузка готова');
		} catch (e) {
			toast.error(e);
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head><title>События безопасности · RTK School</title></svelte:head>

<Page>
	<PageHeader title="События безопасности" />
	{#if !allowed}
		<ErrorState error={new ApiError({ status: 403, detail: 'События безопасности доступны администратору и аудитору.' })} />
	{:else}
		<SecuritySummary {summary} failed={summaryError} />
		<SecurityList extraTypes={summary?.by_type.map((t) => t.event_type) ?? []}>
			{#snippet trailing()}
				<IconBtn icon={Download} label="Выгрузить NDJSON" variant="secondary" disabled={exporting} onclick={exportNdjson} data-testid="security-export" />
			{/snippet}
		</SecurityList>
	{/if}
</Page>
