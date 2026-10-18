// Незапечатанные события аудита (F3-14). Бэкенд в режиме очереди кладёт событие в таблицу и запечатывает его в хэш-цепочку позже;
// ответы `GET /api/admin/audit`, `…/verify-chain` и заголовок `X-Audit-Pending` у выгрузки несут число ожидающих и возраст самого старого.
// Полей `delivery` и `pending` в OpenAPI пока нет (нужны B8/B9): всё читается из сырого ответа и при их отсутствии (режим `sync`,
// старый бэкенд) экран выглядит как раньше. Чистые функции, без DOM и API.

export interface Pending {
	count: number;
	/** возраст самого старого ожидающего события, секунды */
	oldestAgeSeconds: number;
}

export type PendingState = 'off' | 'sealed' | 'sealing' | 'delayed';

/** Старше этого ожидание считается задержкой (значение уточнить замером в B8). */
export const DELAYED_AFTER_SECONDS = 30;
/** После скольких минут непрерывного ожидания опрос замедляется. */
export const SLOW_POLL_AFTER_MS = 10 * 60 * 1000;
export const POLL_SEALED_MS = 15_000;
export const POLL_SEALING_MS = 3_000;
export const POLL_DELAYED_MS = 10_000;
export const POLL_SLOW_MS = 30_000;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** Ответ списка или проверки цепочки → ожидающие события; `null` — режим `sync` или полей нет. */
export function parsePending(raw: unknown): Pending | null {
	if (!raw || typeof raw !== 'object') return null;
	const body = raw as { delivery?: unknown; pending?: unknown };
	if (body.delivery !== 'queue') return null;
	const p = body.pending;
	if (!p || typeof p !== 'object') return null;
	const count = num((p as { count?: unknown }).count);
	if (count === null) return null;
	return { count: Math.trunc(count), oldestAgeSeconds: num((p as { oldest_age_seconds?: unknown }).oldest_age_seconds) ?? 0 };
}

export function pendingState(p: Pending | null | undefined): PendingState {
	if (!p) return 'off';
	if (p.count <= 0) return 'sealed';
	return p.oldestAgeSeconds > DELAYED_AFTER_SECONDS ? 'delayed' : 'sealing';
}

/** Через сколько мс спрашивать снова; `null` — не спрашивать (режим выключен или вкладка скрыта). */
export function pollDelay(p: Pending | null | undefined, hidden: boolean, waitedMs: number): number | null {
	const state = pendingState(p);
	if (state === 'off' || hidden) return null;
	if (state === 'sealed') return POLL_SEALED_MS;
	if (waitedMs >= SLOW_POLL_AFTER_MS) return POLL_SLOW_MS;
	return state === 'sealing' ? POLL_SEALING_MS : POLL_DELAYED_MS;
}

/** 0,4 → «меньше секунды», 4,2 → «4 с», 75 → «1 мин 15 с», 7300 → «2 ч 1 мин». */
export function formatAge(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 1) return 'меньше секунды';
	const total = Math.round(seconds);
	if (total < 60) return `${total} с`;
	if (total < 3600) {
		const m = Math.floor(total / 60);
		const s = total % 60;
		return s ? `${m} мин ${s} с` : `${m} мин`;
	}
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	return m ? `${h} ч ${m} мин` : `${h} ч`;
}

const eventsWord = (n: number): string => {
	const abs = n % 100;
	const last = abs % 10;
	if (abs > 10 && abs < 20) return 'событий';
	if (last === 1) return 'событие';
	return last >= 2 && last <= 4 ? 'события' : 'событий';
};
const waitVerb = (n: number): string => (n % 10 === 1 && n % 100 !== 11 ? 'ждёт' : 'ждут');

/** Текст плашки над журналом по состоянию; `null` — плашки нет. */
export function bannerText(p: Pending | null | undefined): { tone: 'info' | 'warning'; title: string; text: string } | null {
	const state = pendingState(p);
	if (!p || (state !== 'sealing' && state !== 'delayed')) return null;
	if (state === 'sealing') {
		return { tone: 'info', title: `Ожидают запечатывания: ${p.count}`, text: `Самое старое — ${formatAge(p.oldestAgeSeconds)}. Они появятся в списке сами.` };
	}
	return {
		tone: 'warning',
		title: `Запечатывание задерживается: ${p.count} ${eventsWord(p.count)} ${waitVerb(p.count)} ${formatAge(p.oldestAgeSeconds)}`,
		text: 'События сохранены и будут записаны. Если задержка растёт, сообщите администратору.'
	};
}

/** Строка в окне проверки цепочки. */
export function chainNote(p: Pending | null | undefined): string | null {
	if (!p || p.count <= 0) return null;
	return `Не вошло в проверку: ${p.count} ${eventsWord(p.count)} ${waitVerb(p.count)} запечатывания, самое старое — ${formatAge(p.oldestAgeSeconds)}`;
}

/**
 * Свежая первая страница поверх уже загруженных строк: новые добавляются сверху без повторов. Если ни одна строка свежей страницы
 * не совпала с уже загруженными (все строки новые), между ними мог образоваться разрыв — `gap: true`, нужна полная перезагрузка.
 */
export function mergeHead<T extends { id: string }>(current: readonly T[], fresh: readonly T[]): { items: T[]; gap: boolean } {
	if (!current.length) return { items: [...fresh], gap: false };
	const known = new Set(current.map((r) => r.id));
	const added = fresh.filter((r) => !known.has(r.id));
	if (!added.length) return { items: [...current], gap: false };
	if (added.length === fresh.length) return { items: [...current], gap: true };
	return { items: [...added, ...current], gap: false };
}

/** Заголовок `X-Audit-Pending` выгрузки → «Не вошло ожидающих: 12»; нет заголовка или ноль — `null`. */
export function exportNote(header: string | null | undefined): string | null {
	if (header === null || header === undefined || header.trim() === '') return null;
	const n = Number(header);
	return Number.isFinite(n) && n > 0 ? `Не вошло ожидающих: ${Math.trunc(n)}` : null;
}

/** Время события: `occurred_at` (когда произошло), а если бэкенд его не отдаёт — `created_at`; `sealed` — когда запечатано, если отличается. */
export function occurredAt(e: { created_at: string }): { event: string; sealed: string | null } {
	const raw = (e as { occurred_at?: unknown }).occurred_at;
	return typeof raw === 'string' && raw ? { event: raw, sealed: raw === e.created_at ? null : e.created_at } : { event: e.created_at, sealed: null };
}
