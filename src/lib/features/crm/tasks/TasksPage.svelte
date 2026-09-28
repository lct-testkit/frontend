<script lang="ts">
	// Мои задачи: чипы «Открытые / В работе / Просроченные / Выполненные / Все», группы по сроку, флажок «выполнено».
	// HEAD и ADMIN видят задачи всех исполнителей своего скоупа и могут выбрать сотрудника.
	import { untrack } from 'svelte';
	import { page } from '$app/state';
		import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState, ErrorState, FilterBar, IconBtn, Page, PageHeader, RowList, Skeleton, TabsBar, UserPicker } from '$lib/ui';
	import { setQuery } from '$lib/utils/query-state.svelte';
			import Pick from '$lib/ui/fields/Pick.svelte';
	import { PRIORITY_LABELS } from '../shared/labels';
	import type { Task } from '../types';
	import TaskDrawer from './TaskDrawer.svelte';
	import TaskRow from './TaskRow.svelte';
	import { TaskCounts } from './taskCounts.svelte';
	import { DUE_GROUP_LABELS, DUE_GROUP_ORDER, dueGroup } from './taskUtils';

	const view = $derived(page.url.searchParams.get('view') ?? 'open');
	const priority = $derived(page.url.searchParams.get('priority') ?? '');
	const assignee = $derived(page.url.searchParams.get('assignee') ?? '');
	const wantedTask = $derived(page.url.searchParams.get('task'));
	const meId = $derived(session.me?.id);
	const canPickAssignee = $derived(session.can('deal:reassign'));

	const params = $derived({
		assignee_id: assignee === 'all' ? undefined : assignee || meId,
		status: view === 'open' || view === 'in_progress' || view === 'done' ? view : undefined,
		overdue: view === 'overdue' ? true : undefined,
		priority: priority || undefined
	});

	const pager = createPager<Task>(async (cursor, signal) =>
		unwrap(api.GET('/api/tasks', { params: { query: { ...params, limit: 100, cursor: cursor ?? undefined } }, signal }))
	);

	$effect(() => {
		JSON.stringify(params);
		if (meId && session.can('deal:read')) untrack(() => void pager.reload());
	});
	$effect(() => {
		people.ensure(pager.items.map((t) => t.assignee_id));
	});

	const counts = new TaskCounts();
	$effect(() => {
		const base = { assignee_id: params.assignee_id, priority: params.priority };
		if (meId && session.can('deal:read')) untrack(() => void counts.load(base));
	});

	let drawer = $state<{ task: Task | null } | null>(null);

	// ссылка из уведомления `/tasks?task=<id>`: открыть задачу, как только список загружен
	let opened = '';
	$effect(() => {
		const id = wantedTask;
		if (!id || opened === id) return;
		const found = pager.items.find((t) => t.id === id);
		if (found) {
			opened = id;
			untrack(() => (drawer = { task: found }));
		}
	});

	const viewTabs = $derived([
		{ key: 'open', label: 'Открытые', count: counts.counts.open },
		{ key: 'in_progress', label: 'В работе', count: counts.counts.in_progress },
		{ key: 'overdue', label: 'Просроченные', count: counts.counts.overdue },
		{ key: 'done', label: 'Выполненные', count: counts.counts.done },
		{ key: 'all', label: 'Все', count: counts.counts.all }
	]);
	const priorityItems = Object.entries(PRIORITY_LABELS).map(([key, value]) => ({ key, value }));
	const filterCount = $derived([priority, canPickAssignee && assignee].filter(Boolean).length);

	const groups = $derived(
		DUE_GROUP_ORDER.map((key) => ({ key, tasks: pager.items.filter((t) => dueGroup(t) === key).sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? '')) })).filter((g) => g.tasks.length)
	);

	function saved(task: Task) {
		void counts.load({ assignee_id: params.assignee_id, priority: params.priority });
		if (pager.items.some((t) => t.id === task.id)) pager.patch((t) => t.id === task.id, task);
		else pager.prepend(task);
		drawer = null;
	}
</script>

<svelte:head><title>Задачи · RTK School</title></svelte:head>

{#snippet filters()}
	<Pick label="Приоритет" items={priorityItems} clearable value={priority || null} placeholder="Любой" onChange={(v) => setQuery({ priority: v })} />
	{#if canPickAssignee}
		<UserPicker label="Исполнитель" roles={['KAM', 'HEAD']} value={assignee && assignee !== 'all' ? assignee : null} placeholder="Я" onChange={(id) => setQuery({ assignee: id })} />
	{/if}
{/snippet}

<Page>
	<PageHeader title="Задачи" primary={session.can('deal:update') ? { label: 'Новая задача', onclick: () => (drawer = { task: null }), testid: 'task-new' } : undefined}>
		{#snippet tabs(underline)}
			{#if session.can('deal:read')}<TabsBar items={viewTabs} value={view} onChange={(k) => setQuery({ view: k === 'open' ? null : k })} label="Какие задачи показывать" {underline} />{/if}
		{/snippet}
		{#snippet actions()}
			{#if session.can('deal:read')}<IconBtn icon={Refresh} label="Обновить" onclick={() => pager.reload()} />{/if}
		{/snippet}
	</PageHeader>

	{#if !session.can('deal:read')}
		<EmptyState title="Нет доступа к задачам" compact />
	{:else}
		<FilterBar active={filterCount} onReset={() => setQuery({ priority: null, assignee: null })} {filters} />

		{#if pager.loading && pager.items.length === 0}
			<Skeleton kind="list" rows={5} />
		{:else if pager.error}
			<ErrorState error={pager.error} onRetry={() => pager.reload()} />
		{:else if groups.length === 0}
			<EmptyState title={view === 'done' ? 'Выполненных задач нет' : 'Задач нет'} compact>
				{#snippet action()}{#if session.can('deal:update')}<Btn label="Новая задача" variant="outline" colorScheme="neutral" onclick={() => (drawer = { task: null })} />{/if}{/snippet}
			</EmptyState>
		{:else}
			{#each groups as group (group.key)}
				<RowList title={DUE_GROUP_LABELS[group.key]} count={group.tasks.length} danger={group.key === 'overdue'}>
					{#each group.tasks as task (task.id)}
						<TaskRow {task} showDeal showAssignee={canPickAssignee} onOpen={(t) => (drawer = { task: t })} onChanged={(t) => (pager.patch((x) => x.id === t.id, t), void counts.load({ assignee_id: params.assignee_id, priority: params.priority }))} />
					{/each}
				</RowList>
			{/each}
			{#if pager.hasMore}<div class="flex justify-center"><Btn label="Показать ещё" variant="outline" colorScheme="neutral" loading={pager.loadingMore} onclick={() => pager.loadMore()} /></div>{/if}
		{/if}
	{/if}
</Page>

<TaskDrawer open={drawer !== null} task={drawer?.task ?? null} onClose={() => (drawer = null)} onSaved={saved} />
