<script lang="ts">
	// Вкладка «Филиалы»: филиалы и институты вуза деревом (родитель задаётся в форме). Читает любой, кто видит вуз; менять — право organization:write.
	// Сервер отдаёт плоский список (`GET .../branches`), дерево собирает клиент; удалить филиал с дочерними нельзя (409), цикл в иерархии — 422.
	import { onMount } from 'svelte';
	import { AddLarge, Edit, Trash } from '@lct-testkit/rt-ui/icons';
	import { ApiError, api, errorMessage, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState, ErrorState, IconBtn, ListRow, RowList, Skeleton, confirm, toast } from '$lib/ui';
	import type { Branch } from '../types';
	import BranchModal from './BranchModal.svelte';
	import { BRANCH_LIMIT, branchRows } from './branchTree';

	let { orgId }: { orgId: string } = $props();

	let items = $state<Branch[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let editing = $state<Branch | null>(null);
	let creating = $state(false);

	const canWrite = $derived(session.can('organization:write'));
	const rows = $derived(branchRows(items));
	const full = $derived(items.length >= BRANCH_LIMIT);

	async function load() {
		error = null;
		try {
			items = (await unwrap(api.GET('/api/organizations/{organization_id}/branches', { params: { path: { organization_id: orgId } } }))).items;
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	async function remove(b: Branch, children: number) {
		if (children) {
			toast.warning('Нельзя удалить', 'У филиала есть дочерние — сначала удалите или перенесите их.');
			return;
		}
		if (!(await confirm({ title: `Удалить «${b.name}»?`, message: 'Филиал исчезнет из списка.', confirmLabel: 'Удалить', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/organizations/{organization_id}/branches/{branch_id}', { params: { path: { organization_id: orgId, branch_id: b.id } } }));
			items = items.filter((x) => x.id !== b.id);
			toast.success('Филиал удалён');
		} catch (e) {
			toast.error(e instanceof ApiError && e.isConflict ? 'У филиала есть дочерние — сначала удалите их.' : e);
		}
	}

	function saved(b: Branch, created: boolean) {
		items = created ? [...items, b] : items.map((x) => (x.id === b.id ? b : x));
		creating = false;
		editing = null;
	}
</script>

<div class="flex min-w-0 flex-col gap-3">
	{#if canWrite}
		<div class="flex flex-wrap items-center gap-3">
			<Btn label="Добавить филиал" icon={AddLarge} disabled={full} onclick={() => (creating = true)} data-testid="branch-add" />
			{#if full}<span class="t-desc-l text-muted">Достигнут предел — {BRANCH_LIMIT} филиалов.</span>{/if}
		</div>
	{/if}

	{#if loading}
		<Skeleton kind="list" rows={3} />
	{:else if error}
		<ErrorState {error} onRetry={load} compact />
	{:else if rows.length === 0}
		<EmptyState title="Филиалов и институтов нет" hint={canWrite ? 'Добавьте филиал или институт вуза — у каждого можно указать адрес.' : undefined} compact />
	{:else}
		<RowList label="Филиалы и институты" count={rows.length}>
			{#each rows as { branch, depth, children } (branch.id)}
				<ListRow title={branch.name}>
					{#snippet prefix()}
						{#if depth}<span class="block flex-none" style:width="{depth * 20}px" aria-hidden="true"></span>{/if}
					{/snippet}
					{#snippet description()}
						<span class="break-words">{branch.address || 'Адрес не указан'}</span>
						{#if children}<span>дочерних: {children}</span>{/if}
					{/snippet}
					{#snippet suffix()}
						{#if canWrite}
							<IconBtn icon={Edit} label="Изменить" onclick={() => (editing = branch)} />
							<IconBtn icon={Trash} label="Удалить" onclick={() => remove(branch, children)} />
						{/if}
					{/snippet}
				</ListRow>
			{/each}
		</RowList>
	{/if}
</div>

<BranchModal open={creating || editing !== null} {orgId} {items} item={creating ? null : editing} onClose={() => ((creating = false), (editing = null))} onSaved={saved} />
