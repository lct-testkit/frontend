<script lang="ts">
	// Строка задачи: флажок «выполнено», название, срок (просроченный — красным), исполнитель, сделка, приоритет. Клик по строке — открыть.
	import { Checkbox } from '@lct-testkit/rt-ui';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { DateText, ListRow, toast } from '$lib/ui';
	import PriorityChip from '../shared/PriorityChip.svelte';
	import { TASK_STATUS_LABELS } from '../shared/labels';
	import type { Task } from '../types';
	import { isOpenTask, isOverdue } from './taskUtils';

	interface Props {
		task: Task;
		/** показывать номер и название сделки (на странице «Задачи») */
		showDeal?: boolean;
		showAssignee?: boolean;
		onOpen: (task: Task) => void;
		onChanged: (task: Task) => void;
	}

	let { task, showDeal = false, showAssignee = true, onOpen, onChanged }: Props = $props();

	let busy = $state(false);
	const done = $derived(task.status === 'done');
	const overdue = $derived(isOverdue(task));

	async function toggle(checked: boolean) {
		if (busy) return;
		busy = true;
		try {
			const next = checked
				? await unwrap(api.POST('/api/tasks/{task_id}/complete', { params: { path: { task_id: task.id } } }))
				: await unwrap(api.PATCH('/api/tasks/{task_id}', { params: { path: { task_id: task.id } }, body: { status: 'open' } }));
			onChanged(next);
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}
</script>

{#snippet prefix()}
	<Checkbox variant="primary" checked={done} disabled={busy || task.status === 'cancelled'} aria-label="Выполнено" onChange={(v: boolean) => toggle(v)} />
{/snippet}

{#snippet description()}
	{#if task.due_at}
		<span class={overdue ? 'text-danger' : ''}>{overdue ? 'Просрочена: ' : 'До '}<DateText value={task.due_at} /></span>
	{/if}
	{#if showAssignee}<span>{people.name(task.assignee_id)}</span>{/if}
	{#if task.status === 'in_progress' || task.status === 'cancelled'}<span>{TASK_STATUS_LABELS[task.status]}</span>{/if}
	{#if showDeal}
		<span class="min-w-0 truncate">
			{#if task.deal_number}<a class="relative z-10" href="/deals/{task.deal_id}">{task.deal_number}</a> · {task.deal_title}{:else}Сделка недоступна{/if}
		</span>
	{/if}
{/snippet}

{#snippet suffix()}<PriorityChip priority={task.priority} onlyUrgent />{/snippet}

<ListRow title={task.title} muted={!isOpenTask(task)} {prefix} {description} {suffix} onclick={() => onOpen(task)} />
