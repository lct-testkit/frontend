<script lang="ts">
	// «История публикаций»: кто и когда публиковал воронку, хэш графа (из журнала аудита; нужно право читать журнал). Вернуть прошлую версию нельзя:
	// бэкенд хранит только последний опубликованный снимок.
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { DateText, EmptyState, ErrorState, Notice, Skeleton, StatusChip } from '$lib/ui';
	import AppDrawer from '$lib/ui/AppDrawer.svelte';
	import { publications, type Publication } from '../publications';

	interface Props {
		open: boolean;
		workflowId: string;
		onClose: () => void;
	}

	let { open, workflowId, onClose }: Props = $props();

	let list = $state<Publication[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			const page = await unwrap(api.GET('/api/admin/audit', { params: { query: { action: 'WORKFLOW_PUBLISHED', entity_type: 'workflow', entity_id: workflowId, limit: 100 } } }));
			list = publications(page.items);
			people.ensure(list.map((p) => p.by));
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	$effect(() => {
		if (open) untrack(() => void load());
	});
</script>

<AppDrawer {open} title="История публикаций" width={480} {onClose}>
	<div class="flex flex-col gap-3">
		<Notice class="shrink-0" tone="info">Вернуть прошлую версию нельзя: сервер хранит только последнюю опубликованную.</Notice>
		{#if loading}
			<Skeleton kind="rows" rows={4} />
		{:else if error}
			<ErrorState {error} onRetry={load} compact />
		{:else if list.length === 0}
			<EmptyState title="Публикаций не было" compact />
		{:else}
			<ol class="m-0 flex list-none flex-col gap-2 p-0" data-testid="publications">
				{#each list as p (p.id)}
					<li class="flex min-w-0 flex-col gap-1 rounded-md border border-line bg-surface p-3">
						<span class="flex flex-wrap items-center gap-2"><DateText value={p.at} time />{#if p.current}<StatusChip label="Действует" tone="success" />{/if}</span>
						<span class="t-desc-l text-muted">{p.by ? people.name(p.by) : 'Система'}{p.hash ? ` · версия графа ${p.hash}` : ''}</span>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
</AppDrawer>
