<script lang="ts">
	// Задача: создание (в карточке сделки — с известной сделкой, на странице задач — с выбором сделки) и правка.
	// Срок — дата; считаем концом рабочего дня (18:00), чтобы «сегодня» не становилось просрочкой с утра.
	import { untrack } from 'svelte';
	import { api, ApiError, errorMessage, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { FormDrawer, FormRow, UserPicker, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import DealPicker from '../shared/pickers/DealPicker.svelte';
	import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '../shared/labels';
	import type { Task } from '../types';
	import { toDueIso, toLocalDate } from './taskUtils';

	type Priority = 'low' | 'normal' | 'high' | 'critical';
	type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

	interface Props {
		open: boolean;
		/** правка существующей задачи */
		task?: Task | null;
		/** создание внутри сделки */
		dealId?: string | null;
		onClose: () => void;
		onSaved: (task: Task) => void;
	}

	let { open, task = null, dealId = null, onClose, onSaved }: Props = $props();

	let title = $state('');
	let description = $state('');
	let assignee = $state<string | null>(null);
	let due = $state<string | null>(null);
	let priority = $state('normal');
	let status = $state('open');
	let deal = $state<string | null>(null);
	let errors = $state<Record<string, string>>({});
	let failure = $state<string | null>(null);
	let busy = $state(false);

	const current = $derived(JSON.stringify([title, description, assignee, due, priority, status, deal]));
	let initial = $state('');

	$effect(() => {
		if (!open) return;
		untrack(() => {
			title = task?.title ?? '';
			description = task?.description ?? '';
			assignee = task?.assignee_id ?? session.me?.id ?? null;
			due = task?.due_at ? toLocalDate(task.due_at) : null;
			priority = task?.priority ?? 'normal';
			status = task?.status ?? 'open';
			deal = task?.deal_id ?? dealId;
			errors = {};
			failure = null;
			initial = current;
		});
	});

	const priorityItems = Object.entries(PRIORITY_LABELS).map(([key, value]) => ({ key, value }));
	const statusItems = Object.entries(TASK_STATUS_LABELS).map(([key, value]) => ({ key, value }));

	async function submit() {
		if (busy) return;
		const next: Record<string, string> = {};
		if (!title.trim()) next.title = 'Введите название задачи';
		if (!deal) next.deal_id = 'Выберите сделку';
		if (!assignee) next.assignee_id = 'Выберите исполнителя';
		errors = next;
		if (Object.keys(next).length) return;
		busy = true;
		failure = null;
		try {
			const dueAt = due ? toDueIso(due) : null;
			const saved = task
				? await unwrap(
						api.PATCH('/api/tasks/{task_id}', {
							params: { path: { task_id: task.id } },
							body: { title: title.trim(), description: description.trim() || null, assignee_id: assignee, due_at: dueAt, priority: priority as Priority, status: status as TaskStatus }
						})
					)
				: await unwrap(
						api.POST('/api/tasks', {
							body: { deal_id: deal!, title: title.trim(), description: description.trim() || null, assignee_id: assignee!, due_at: dueAt, priority: priority as Priority }
						})
					);
			toast.success(task ? 'Задача сохранена' : 'Задача создана');
			onSaved(saved);
		} catch (e) {
			if (e instanceof ApiError && e.isValidation && Object.keys(e.fieldErrors()).length) errors = e.fieldErrors();
			else failure = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormDrawer {open} title={task ? 'Задача' : 'Новая задача'} saveLabel={task ? 'Сохранить' : 'Создать'} saveTestId="task-submit" saving={busy} dirty={open && current !== initial} formError={failure} onSave={submit} {onClose}>
	<TextField label="Название" autofocus={!task} value={title} error={errors.title} onInput={(v) => ((title = v), (errors.title = ''))} />
	{#if !task && !dealId}<DealPicker value={deal} error={errors.deal_id} onChange={(id) => ((deal = id), (errors.deal_id = ''))} />{/if}
	<AreaField label="Описание" rows={3} value={description} onInput={(v) => (description = v)} />
	<UserPicker label="Исполнитель" roles={['KAM', 'HEAD']} value={assignee} error={errors.assignee_id} clearable={false} onChange={(id) => ((assignee = id), (errors.assignee_id = ''))} />
	<FormRow>
		<DateField label="Срок" value={due} onChange={(v) => (due = v)} />
		<Pick label="Приоритет" items={priorityItems} value={priority} onChange={(v) => v && (priority = v)} />
	</FormRow>
	{#if task}<Pick label="Статус" items={statusItems} value={status} onChange={(v) => v && (status = v)} />{/if}
</FormDrawer>
