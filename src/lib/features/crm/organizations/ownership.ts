// Ответственный за вуз: права, проверка причины, массовая смена (по 100 вузов за вызов) и разбор истории смен из журнала аудита.
import { errorMessage } from '$lib/api/errors';

export const REASON_MIN = 3;
export const REASON_MAX = 500;
/** Сколько вузов принимает один вызов `POST /api/organizations/bulk/owner`. */
export const BULK_CHUNK = 100;

/** Назначать, менять и снимать ответственного может тот, у кого есть право `organization:assign_owner` (Руководитель, Администратор). */
export const canAssignOwner = (can: (permission: string) => boolean): boolean => can('organization:assign_owner');

/** Текст ошибки для поля «Причина» или `null`, если причина подходит. */
export function validateReason(raw: string): string | null {
	const text = raw.trim();
	if (text.length < REASON_MIN) return `Укажите причину (не короче ${REASON_MIN} символов)`;
	if (text.length > REASON_MAX) return `Причина длиннее ${REASON_MAX} символов`;
	return null;
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
	return out;
}

export interface OwnerChange {
	/** новый ответственный; `null` — снять */
	ownerId: string | null;
	reason: string;
	/** передать и открытые сделки вуза (нужно право на массовую передачу сделок) */
	carryOpenDeals?: boolean;
}

export interface BulkSkip {
	organization_id: string;
	reason: string;
}

export interface BulkOwnerResponse {
	changed: number;
	deals_reassigned?: number;
	skipped?: BulkSkip[];
}

export interface BulkOwnerResult {
	changed: number;
	dealsReassigned: number;
	skipped: BulkSkip[];
}

export type BulkOwnerCall = (body: { organization_ids: string[]; owner_id: string | null; reason: string; carry_open_deals: boolean }) => Promise<BulkOwnerResponse>;

/**
 * Смена ответственного у многих вузов: пакетами по 100, последовательно. Пропущенные сервером вузы (нет доступа и т. п.) попадают в `skipped`
 * с причиной; пакет, который не прошёл целиком (сеть, 403), помечается пропущенным весь — остальные пакеты продолжаются.
 */
export async function runBulkOwnerChange(ids: readonly string[], change: OwnerChange, call: BulkOwnerCall): Promise<BulkOwnerResult> {
	const result: BulkOwnerResult = { changed: 0, dealsReassigned: 0, skipped: [] };
	for (const part of chunk([...new Set(ids)], BULK_CHUNK)) {
		try {
			const res = await call({ organization_ids: part, owner_id: change.ownerId, reason: change.reason.trim(), carry_open_deals: change.carryOpenDeals ?? false });
			result.changed += res.changed;
			result.dealsReassigned += res.deals_reassigned ?? 0;
			result.skipped.push(...(res.skipped ?? []));
		} catch (e) {
			const reason = errorMessage(e);
			result.skipped.push(...part.map((organization_id) => ({ organization_id, reason })));
		}
	}
	return result;
}

export interface OwnerChangeEntry {
	at: string;
	actorId: string | null;
	oldId: string | null;
	newId: string | null;
	reason: string | null;
}

interface AuditLike {
	created_at: string;
	actor_id?: string | null;
	changes?: Record<string, unknown> | null;
}

const asId = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Записи журнала, где менялся ответственный (`changes.owner_id = {old, new}`), от новых к старым; остальные записи пропускаются. */
export function ownerHistory(entries: readonly AuditLike[]): OwnerChangeEntry[] {
	const out: OwnerChangeEntry[] = [];
	for (const e of entries) {
		const owner = e.changes?.owner_id;
		if (!owner || typeof owner !== 'object') continue;
		const o = owner as { old?: unknown; new?: unknown };
		const reason = e.changes?.reason;
		const reasonText = reason && typeof reason === 'object' ? (reason as { new?: unknown }).new : reason;
		out.push({ at: e.created_at, actorId: e.actor_id ?? null, oldId: asId(o.old), newId: asId(o.new), reason: typeof reasonText === 'string' && reasonText ? reasonText : null });
	}
	return out.sort((a, b) => b.at.localeCompare(a.at));
}
