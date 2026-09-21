<script lang="ts">
	// Вкладка «Задачи» сделки: открытые и выполненные, флажок «выполнено», «Новая задача».
	import { untrack } from 'svelte';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { AddLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { Btn, EmptyState, ErrorState, Skeleton } from '$lib/ui';
	import type { Task } from '../types';
	import TaskDrawer from './TaskDrawer.svelte';
	import TaskRow from './TaskRow.svelte';
	import { isOpenTask } from './taskUtils';

	interface Props {
		dealId: string;
		canWrite: boolean;
		refreshKey?: number;
		onCount?: (open: number) => void;
	}

	let { dealId, canWrite, refreshKey = 0, onCount }: Props = $props();

	let items = $state<Task[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let view = $state('open');
	let drawer = $state<{ task: Task | null } | null>(null);

	async function load() {
		error = null;
		try {
			const all: Task[] = [];
			let cursor: string | undefined;
			for (let i = 0; i < 5; i += 1) {
				const page = await unwrap(api.GET('/api/tasks', { params: { query: { deal_id: dealId, limit: 100, cursor } } }));
				all.push(...page.items);
				if (!page.next_cursor) break;
				cursor = page.next_cursor;
			}
			items = all;
			people.ensure(all.map((t) => t.assignee_id));
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void refreshKey;
		untrack(() => void load());
	});
	$effect(() => onCount?.(items.filter(isOpenTask).length));

	const shown = $derived(
		items
			.filter((t) => (view === 'open' ? isOpenTask(t) : view === 'done' ? !isOpenTask(t) : true))
			.sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
	);
	const chips = $derived([
		{ key: 'open', label: 'Открытые', counter: items.filter(isOpenTask).length },
		{ key: 'done', label: 'Завершённые', counter: items.filter((t) => !isOpenTask(t)).length },
		{ key: 'all', label: 'Все' }
	]);

	function saved(task: Task) {
		items = items.some((t) => t.id === task.id) ? items.map((t) => (t.id === task.id ? task : t)) : [...items, task];
		drawer = null;
	}
	const changed = (task: Task) => (items = items.map((t) => (t.id === task.id ? task : t)));
</script>

<div class="flex min-w-0 flex-col gap-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<SegmentedControl value={view} onChange={(v) => (view = String(v))} size="m">
			{#each chips as chip (chip.key)}<Segment index={chip.key} label={chip.counter === undefined ? chip.label : `${chip.label} · ${chip.counter}`} />{/each}
		</SegmentedControl>
		{#if canWrite}<Btn label="Новая задача" icon={AddLarge} onclick={() => (drawer = { task: null })} data-testid="task-new" />{/if}
	</div>

	{#if loading}
		<Skeleton kind="rows" rows={3} />
	{:else if error}
		<ErrorState {error} onRetry={load} compact />
	{:else if shown.length === 0}
		<EmptyState title={view === 'open' ? 'Открытых задач нет' : 'Задач нет'} compact />
	{:else}
		<ul class="m-0 list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
			{#each shown as task (task.id)}
				<TaskRow {task} onOpen={(t) => (drawer = { task: t })} onChanged={changed} />
			{/each}
		</ul>
	{/if}
</div>

<TaskDrawer open={drawer !== null} task={drawer?.task ?? null} {dealId} onClose={() => (drawer = null)} onSaved={saved} />
