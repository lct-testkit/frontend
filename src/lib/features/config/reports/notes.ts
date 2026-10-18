// Пометки к отчёту: усечение по «Не больше строк» и данные из снимка. Чистый модуль: что показать — решает `reportNotes`, как — `ReportNotes.svelte`.
import { formatNumber, formatTime } from '$lib/utils/format';

export interface NoteInput {
	/** сколько строк пришло */
	rowCount?: number | null;
	/** предел «Не больше строк», с которым запущен отчёт */
	limit?: number | null;
	/** сервер сам сообщил об усечении; не задано — старый ответ, работает запасное правило */
	truncated?: boolean | null;
	/** сколько строк было по выборке до усечения */
	totalRows?: number | null;
	/** пометка набора («Источник: материализованное представление …») */
	note?: string | null;
	/** данные взяты из снимка (когда пометки `note` нет под рукой) */
	snapshot?: boolean;
	/** на какой момент данные (ISO) */
	asOf?: string | null;
}

export interface ReportNote {
	kind: 'truncated' | 'snapshot' | 'info';
	tone: 'warning' | 'info';
	text: string;
}

/** Максимум «Не больше строк» на сервере (builders.py): подсказка, до скольки можно поднять предел. */
const MAX_LIMIT = 5000;

export function reportNotes(input: NoteInput): ReportNote[] {
	const notes: ReportNote[] = [];
	const { rowCount, limit, totalRows, note, asOf } = input;
	const truncated = input.truncated ?? (rowCount != null && limit != null && rowCount >= limit ? 'maybe' : false);
	if (truncated === true && rowCount != null && totalRows != null && totalRows > rowCount) {
		notes.push({
			kind: 'truncated',
			tone: 'warning',
			text: `Показано ${formatNumber(rowCount)} из ${formatNumber(totalRows)} строк: сработал предел «Не больше строк». Увеличьте его (до ${formatNumber(MAX_LIMIT)}) или сузьте фильтры`
		});
	} else if (truncated) {
		notes.push({
			kind: 'truncated',
			tone: 'warning',
			text:
				rowCount != null
					? `В отчёте ${formatNumber(rowCount)} строк — это предел «Не больше строк», часть данных могла не войти. Увеличьте его или сузьте фильтры`
					: 'Сработал предел «Не больше строк», часть данных могла не войти. Увеличьте его или сузьте фильтры'
		});
	}
	if (input.snapshot || (note && /материализованн/i.test(note))) {
		const at = asOf ? `, на ${formatTime(asOf)}` : '';
		notes.push({
			kind: 'snapshot',
			tone: 'info',
			text: `Данные из снимка, который обновляется раз в 5 минут${at}. С фильтрами отчёт считается по актуальным данным`
		});
	} else if (note) {
		notes.push({ kind: 'info', tone: 'info', text: note });
	}
	return notes;
}

/**
 * Снимок у «Воронки по статусам»: сервер читает материализованное представление, когда отчёт строит ADMIN и фильтров общего блока нет
 * (builders.py). У задания пометки `note` нет, поэтому правило повторено здесь.
 */
export function isFunnelSnapshot(templateCode: string, params: Record<string, unknown>, isAdmin: boolean): boolean {
	if (templateCode !== 'deal_funnel' || !isAdmin) return false;
	const filters = ['date_from', 'date_to', 'organization_ids', 'direction_ids', 'product_ids', 'owner_ids'];
	return !filters.some((k) => {
		const v = params[k];
		return Array.isArray(v) ? v.length > 0 : v != null && v !== '';
	});
}

/** Вход для `reportNotes` из задания отчёта (`result_meta` сервер заполняет, когда задание готово). */
export function jobNoteInput(
	job: { template_code: string; params: Record<string, unknown>; row_count?: number | null; result_meta?: Record<string, unknown> | null },
	isAdmin: boolean
): NoteInput {
	const meta = job.result_meta ?? {};
	const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
	return {
		rowCount: job.row_count ?? num(meta.row_count),
		limit: num(job.params.limit),
		truncated: typeof meta.truncated === 'boolean' ? meta.truncated : null,
		totalRows: num(meta.total_rows),
		snapshot: isFunnelSnapshot(job.template_code, job.params, isAdmin),
		asOf: typeof meta.data_as_of === 'string' ? meta.data_as_of : null
	};
}
