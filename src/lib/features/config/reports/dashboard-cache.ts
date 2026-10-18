// Кэш данных дашборда в sessionStorage на 5 минут. Хранится то, что нужно виджету: первые `CACHE_ROWS` строк для мини-таблицы
// плюс `totalRows` и суммы, посчитанные по всем строкам ответа, — плитка «Строк в отчёте» и «Показано 8 из N» не зависят от обрезки.
import type { ReportTable } from './table';

export const CACHE_PREFIX = 'rtk.dash.v2.';
/** до v2 в кэше лежала таблица, обрезанная до 300 строк без итогов — такие записи не читаем и вычищаем */
const LEGACY_PREFIX = 'rtk.dash.';
export const TTL_MS = 5 * 60_000;
export const CACHE_ROWS = 300;

export interface CacheEntry {
	at: number;
	table: ReportTable;
	/** задание, по которому построена таблица: `GET /api/reports/{id}/data` отдаёт данные заново (скачать JSON) */
	jobId?: string;
}

export const cacheKey = (dashboardId: string, key: string): string => `${CACHE_PREFIX}${dashboardId}.${key}`;

function store(): Storage | null {
	try {
		return globalThis.sessionStorage ?? null;
	} catch {
		return null;
	}
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function readCache(dashboardId: string, key: string, now: number = Date.now()): CacheEntry | null {
	try {
		const raw = store()?.getItem(cacheKey(dashboardId, key));
		if (!raw) return null;
		const entry = JSON.parse(raw) as unknown;
		if (!isRecord(entry) || typeof entry.at !== 'number' || !isRecord(entry.table)) return null;
		const table = entry.table;
		if (!Array.isArray(table.rows) || !Array.isArray(table.columns) || typeof table.totalRows !== 'number') return null;
		return now - entry.at < TTL_MS ? (entry as unknown as CacheEntry) : null;
	} catch {
		return null;
	}
}

function keysWithPrefix(s: Storage, prefix: string): string[] {
	const keys: string[] = [];
	for (let i = 0; i < s.length; i++) {
		const k = s.key(i);
		if (k?.startsWith(prefix)) keys.push(k);
	}
	return keys;
}

/** Освобождает место: сначала записи старого формата, потом самую давнюю из текущих. Возвращает false, когда убирать нечего. */
function evictOne(s: Storage, keep: string): boolean {
	const legacy = keysWithPrefix(s, LEGACY_PREFIX).filter((k) => !k.startsWith(CACHE_PREFIX));
	if (legacy.length) {
		for (const k of legacy) s.removeItem(k);
		return true;
	}
	let oldest: { key: string; at: number } | null = null;
	for (const k of keysWithPrefix(s, CACHE_PREFIX)) {
		if (k === keep) continue;
		let at = 0;
		try {
			at = Number((JSON.parse(s.getItem(k) ?? '{}') as { at?: number }).at) || 0;
		} catch {
			// битая запись — самая давняя
		}
		if (!oldest || at < oldest.at) oldest = { key: k, at };
	}
	if (!oldest) return false;
	s.removeItem(oldest.key);
	return true;
}

/** Пишет запись; при нехватке места убирает старые и пробует снова. Кэш — удобство, поэтому ошибки не пробрасываются. */
export function writeCache(dashboardId: string, key: string, entry: CacheEntry): boolean {
	const s = store();
	if (!s) return false;
	const k = cacheKey(dashboardId, key);
	let body: string;
	try {
		body = JSON.stringify({ at: entry.at, jobId: entry.jobId, table: { ...entry.table, rows: entry.table.rows.slice(0, CACHE_ROWS) } });
	} catch {
		return false;
	}
	for (let attempt = 0; attempt < 8; attempt++) {
		try {
			s.setItem(k, body);
			return true;
		} catch {
			try {
				if (!evictOne(s, k)) return false;
			} catch {
				return false;
			}
		}
	}
	return false;
}

/** Убирает записи дашборда (при его удалении). */
export function clearDashboardCache(dashboardId: string): void {
	try {
		const s = store();
		if (!s) return;
		for (const k of keysWithPrefix(s, `${CACHE_PREFIX}${dashboardId}.`)) s.removeItem(k);
	} catch {
		// недоступное хранилище — нечего чистить
	}
}
