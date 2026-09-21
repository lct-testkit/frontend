// Задачи: срок как локальная дата ↔ ISO, просрочка, группы по сроку.
import type { Task } from '../types';

/** `2026-09-25` → конец рабочего дня по местному времени, ISO. */
export const toDueIso = (date: string): string => new Date(`${date}T18:00:00`).toISOString();

/** ISO → локальная дата `ГГГГ-ММ-ДД`. */
export function toLocalDate(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const isOpenTask = (t: Pick<Task, 'status'>): boolean => t.status === 'open' || t.status === 'in_progress';

export const isOverdue = (t: Pick<Task, 'status' | 'due_at'>, now: number = Date.now()): boolean =>
	isOpenTask(t) && !!t.due_at && Date.parse(t.due_at) < now;

export type DueGroup = 'overdue' | 'today' | 'week' | 'later' | 'none';

export const DUE_GROUP_LABELS: Record<DueGroup, string> = {
	overdue: 'Просрочено',
	today: 'Сегодня',
	week: 'На этой неделе',
	later: 'Позже',
	none: 'Без срока'
};

const DAY = 86_400_000;

export function dueGroup(task: Pick<Task, 'status' | 'due_at'>, now: number = Date.now()): DueGroup {
	if (!task.due_at) return 'none';
	const due = Date.parse(task.due_at);
	if (isOpenTask(task) && due < now) return 'overdue';
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	if (due < start.getTime() + DAY) return 'today';
	if (due < start.getTime() + 7 * DAY) return 'week';
	return 'later';
}

export const DUE_GROUP_ORDER: DueGroup[] = ['overdue', 'today', 'week', 'later', 'none'];
