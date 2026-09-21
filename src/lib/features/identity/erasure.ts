// Запросы на удаление/обезличивание (new_spec §4.8.4, erasure_service.py): отсчёт отсрочки и доступные действия.
import type { BlockerHint } from './labels';
import { plural } from './offboard';

export interface GraceCountdown {
	state: 'none' | 'active' | 'expired';
	days: number;
	hours: number;
	label: string;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

export function graceCountdown(graceUntil: string | null | undefined, now: number = Date.now()): GraceCountdown {
	if (!graceUntil) return { state: 'none', days: 0, hours: 0, label: '—' };
	const left = new Date(graceUntil).getTime() - now;
	if (!Number.isFinite(left)) return { state: 'none', days: 0, hours: 0, label: '—' };
	if (left <= 0) return { state: 'expired', days: 0, hours: 0, label: 'Отсрочка истекла' };
	const days = Math.floor(left / DAY);
	const hours = Math.floor((left % DAY) / HOUR);
	const label =
		days > 0
			? `Исполнение через ${days} ${plural(days, 'день', 'дня', 'дней')}`
			: `Исполнение через ${Math.max(1, hours)} ${plural(Math.max(1, hours), 'час', 'часа', 'часов')}`;
	return { state: 'active', days, hours, label };
}

export interface ErasureRequestLike {
	status: string;
	grace_until?: string | null;
	act_file_id?: string | null;
}

export interface ErasureActions {
	canRecheck: boolean;
	canReject: boolean;
	canRestore: boolean;
	canAct: boolean;
}

/** Зеркало проверок `ErasureExecutionService.recheck/reject/restore` и роутера `/act`. */
export function erasureActions(r: ErasureRequestLike, now: number = Date.now()): ErasureActions {
	const inGrace = r.status === 'pending' || r.status === 'approved';
	const graceAlive = !r.grace_until || new Date(r.grace_until).getTime() > now;
	return {
		canRecheck: r.status === 'blocked',
		canReject: r.status !== 'completed' && r.status !== 'rejected',
		canRestore: inGrace && graceAlive,
		canAct: r.status === 'completed' && !!r.act_file_id
	};
}

export const ERASURE_STEPS = ['Запрос', 'Блокеры', 'Отсрочка', 'Исполнение', 'Акт'] as const;

/** Индекс текущего шага для WizardStepsHorizontal по статусу запроса. */
export function erasureStepIndex(status: string): number {
	switch (status) {
		case 'blocked':
			return 1;
		case 'pending':
		case 'approved':
			return 2;
		case 'completed':
			return 4;
		case 'rejected':
			return 1;
		default:
			return 0;
	}
}

/** Подсказки правового основания для формы запроса. */
export const LEGAL_BASIS_PRESETS = [
	'ст. 21 152-ФЗ — требование субъекта об уничтожении ПДн',
	'ст. 9 152-ФЗ — отзыв согласия на обработку ПДн',
	'достижение цели обработки / истечение срока хранения',
	'увольнение сотрудника, истечение срока хранения'
] as const;

export interface BlockerAction {
	label: string;
	href: string;
}

/** Куда вести кнопкой рядом с блокером, чтобы его снять (null — снять нельзя или это не про этого субъекта). */
export function blockerAction(action: BlockerHint['action'], subjectType: string, subjectId: string): BlockerAction | null {
	const user = subjectType === 'user';
	switch (action) {
		case 'offboard':
			return user ? { label: 'Передать дела', href: `/admin/users/${subjectId}/offboard` } : null;
		case 'block':
			return user ? { label: 'Открыть карточку', href: `/admin/users/${subjectId}` } : null;
		case 'tasks':
			return { label: 'К задачам', href: '/tasks' };
		case 'users':
			return { label: 'К пользователям', href: '/admin/users' };
		default:
			return null;
	}
}
