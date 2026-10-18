// Перетаскивание карточки на доске: можно ли отпустить её в этот столбец и как не спрашивать сервер на каждый dragstart.
import type { AvailableTransition } from '../../types';

/** ok — переход есть и разрешён роли; role — переход есть, но роли запрещён; none — из этого статуса в этот перейти нельзя. */
export type DropVerdict = 'ok' | 'role' | 'none';

export function dropVerdict(transitions: readonly Pick<AvailableTransition, 'to_status_id' | 'role_allowed'>[], targetStatusId: string): DropVerdict {
	const toTarget = transitions.filter((t) => t.to_status_id === targetStatusId);
	if (!toTarget.length) return 'none';
	return toTarget.some((t) => t.role_allowed) ? 'ok' : 'role';
}

export const TRANSITIONS_TTL_MS = 30_000;

export interface TransitionsCache {
	get(dealId: string): AvailableTransition[] | undefined;
	set(dealId: string, items: AvailableTransition[]): void;
	delete(dealId: string): void;
}

/** Кэш доступных переходов сделки на 30 с: повторное перетаскивание той же карточки не создаёт запрос. */
export function createTransitionsCache(now: () => number = Date.now, ttl = TRANSITIONS_TTL_MS): TransitionsCache {
	const map = new Map<string, { at: number; items: AvailableTransition[] }>();
	return {
		get(dealId) {
			const hit = map.get(dealId);
			if (!hit) return undefined;
			if (now() - hit.at > ttl) {
				map.delete(dealId);
				return undefined;
			}
			return hit.items;
		},
		set: (dealId, items) => void map.set(dealId, { at: now(), items }),
		delete: (dealId) => void map.delete(dealId)
	};
}
