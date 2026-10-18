import { formatDateTime } from '$lib/utils/format';

// Состояние источника для карточки: итог последнего забора (`last_run`), курсоры, подпись и тон чипа. Поля `last_run` бэкенд пишет по-разному
// для сайта (created/duplicates) и LMS (applied), поэтому читаем осторожно, а незнакомое не показываем.

export type Tone = 'success' | 'warning' | 'error' | 'neutral';

export interface LastRun {
	trigger: string | null;
	finishedAt: string | null;
	fetched: number | null;
	/** сколько записей применено: у сайта «создано», у LMS «применено» */
	applied: number | null;
	duplicates: number | null;
	skipped: number | null;
	failed: number | null;
	error: string | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Разбор сырого объекта `last_run`; пустой или чужой объект — `null`. */
export function parseRun(raw: unknown): LastRun | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const run: LastRun = {
		trigger: str(r.trigger),
		finishedAt: str(r.finished_at),
		fetched: num(r.fetched),
		applied: num(r.created) ?? num(r.applied),
		duplicates: num(r.duplicates),
		skipped: num(r.skipped),
		failed: num(r.failed),
		error: str(r.error)
	};
	return run.finishedAt || run.error ? run : null;
}

export function runChip(run: LastRun | null): { label: string; tone: Tone } {
	if (!run) return { label: 'Не запускался', tone: 'neutral' };
	if (run.error) return { label: 'Ошибка', tone: 'error' };
	if ((run.failed ?? 0) > 0) return { label: 'Частично', tone: 'warning' };
	return { label: 'Успешно', tone: 'success' };
}

const TRIGGERS: Record<string, string> = { manual: 'вручную', cron: 'по расписанию' };
export const triggerLabel = (t: string | null): string => (t ? (TRIGGERS[t] ?? t) : '');

export interface RunCount {
	label: string;
	value: number;
	tone?: Tone;
}

/** Счётчики запуска; нули тоже показываем (кроме «дубликатов», которых у LMS нет). */
export function runCounts(run: LastRun | null, code: string): RunCount[] {
	if (!run) return [];
	const out: RunCount[] = [];
	if (run.fetched !== null) out.push({ label: 'получено', value: run.fetched });
	if (run.applied !== null) out.push({ label: code === 'cms' ? 'создано' : 'применено', value: run.applied });
	if (run.duplicates !== null) out.push({ label: 'дубликатов', value: run.duplicates });
	if (run.skipped !== null) out.push({ label: 'пропущено', value: run.skipped });
	if (run.failed !== null) out.push({ label: 'с ошибкой', value: run.failed, tone: run.failed > 0 ? 'error' : undefined });
	return out;
}

const CURSOR_LABELS: Record<string, string> = { leads_updated_since: 'Заявки с сайта', students_progress: 'Прогресс обучения' };

export interface CursorLine {
	key: string;
	label: string;
	/** сырое значение курсора: его копируют и показывают в подсказке */
	value: string;
	/** то же по-человечески: «до 18.10.2026, 11:20» в часовом поясе пользователя */
	text: string;
}

/** Курсор — момент времени: показываем «до …»; не дата — как есть. */
function cursorText(value: string): string {
	return Number.isNaN(Date.parse(value)) ? value : `до ${formatDateTime(value)}`;
}

/** Курсоры забора («с какого момента читаем»): пустые не показываем; незнакомый ресурс — под своим кодом. */
export function cursorLines(cursors: Record<string, string | null> | undefined): CursorLine[] {
	return Object.entries(cursors ?? {})
		.filter((e): e is [string, string] => Boolean(e[1]))
		.map(([key, value]) => ({ key, label: CURSOR_LABELS[key] ?? key, value, text: cursorText(value) }));
}

/** Почему «Забрать сейчас» недоступна, или `null`, если можно. */
export function pullBlocked(s: { is_active: boolean; code: string }): string | null {
	if (s.code === 'bitrix24') return 'Bitrix24 присылает события сам, забирать нечего';
	if (!s.is_active) return 'Источник отключён: включите его, чтобы забирать данные';
	return null;
}

export function intervalLabel(seconds: number): string {
	if (seconds % 3600 === 0) return `${seconds / 3600} ч`;
	if (seconds % 60 === 0) return `${seconds / 60} мин`;
	return `${seconds} с`;
}

/** Текст подтверждения отключения: что именно перестанет работать. */
export function disableMessage(code: string): string {
	if (code === 'lms') return 'Автоматический забор прогресса остановится, а события для LMS перестанут отправляться.';
	return 'Входящие сообщения источника перестанут приниматься, исходящие события — отправляться.';
}

export interface SourcesSummary {
	text: string;
	tone: Tone;
}

/** Сводка по источникам для плашки состояния; при исправной системе заменяет «Все системы работают», чтобы не противоречить отключённым источникам. */
export function sourcesSummary(sources: { is_active: boolean; name: string; last_error: string | null }[]): SourcesSummary | null {
	if (!sources.length) return null;
	const active = sources.filter((s) => s.is_active);
	if (!active.length) return { text: 'Источники отключены', tone: 'neutral' };
	const broken = active.filter((s) => s.last_error);
	if (broken.length) return { text: `Ошибка забора: ${broken.map((s) => s.name).join(', ')}`, tone: 'error' };
	return { text: `Работают все включённые (${active.length} из ${sources.length})`, tone: active.length === sources.length ? 'success' : 'neutral' };
}
