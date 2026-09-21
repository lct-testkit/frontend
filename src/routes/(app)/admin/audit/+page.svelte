<script lang="ts">
	// Журнал аудита: события, фильтры в URL, проверка целостности и выгрузка NDJSON (только с правом audit:export).
	import { Download, SecurityCheck } from '@lct-testkit/rt-ui/icons';
	import { api } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { apiQuery, AUDIT_FILTER_KEYS, exportFilename, type AuditFilters } from '$lib/features/identity/audit/audit-query';
	import AuditList from '$lib/features/identity/audit/AuditList.svelte';
	import ChainCheckModal from '$lib/features/identity/audit/ChainCheckModal.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import { confirm } from '$lib/ui/confirm.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { readQuery } from '$lib/utils/query-state.svelte';

	let chain = $state(false);
	let exporting = $state(false);

	async function exportNdjson() {
		const ok = await confirm({
			title: 'Выгрузить журнал?',
			message: 'Выгрузка до 10 000 записей с текущими фильтрами. В журнал попадёт событие «Массовая выгрузка».',
			confirmLabel: 'Выгрузить'
		});
		if (!ok) return;
		exporting = true;
		try {
			const filters = Object.fromEntries(AUDIT_FILTER_KEYS.map((k) => [k, readQuery(k)])) as unknown as AuditFilters;
			const q = apiQuery(filters);
			const { data, response } = await api.GET('/api/admin/audit/export', {
				params: { query: { action: q.action, entity_type: q.entity_type, result: q.result, from: q.from, to: q.to, limit: 10000 } },
				parseAs: 'blob'
			});
			if (!response.ok || !data) throw new Error('Не удалось выгрузить журнал');
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

<svelte:head><title>Журнал аудита · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Журнал аудита" />
	<AuditList>
		{#snippet trailing()}
			<IconBtn icon={SecurityCheck} label="Проверить целостность" variant="secondary" onclick={() => (chain = true)} data-testid="audit-chain" />
			{#if session.can('audit:export')}
				<IconBtn icon={Download} label="Выгрузить NDJSON" variant="secondary" disabled={exporting} onclick={exportNdjson} data-testid="audit-export" />
			{/if}
		{/snippet}
	</AuditList>
</Page>

<ChainCheckModal open={chain} onClose={() => (chain = false)} />
