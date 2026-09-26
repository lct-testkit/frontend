// Отчёты и дашборды: параметры шаблонов (backend/app/modules/reporting/builders.py), подписи, срок хранения.

export const REPORT_FORMATS = ['xlsx', 'pdf', 'png'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];
export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = { xlsx: 'Excel', pdf: 'PDF', png: 'Картинка' };

export const REPORT_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_INFO: Record<ReportStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'error' }> = {
	queued: { label: 'В очереди', tone: 'neutral' },
	processing: { label: 'Формируется', tone: 'info' },
	completed: { label: 'Готов', tone: 'success' },
	failed: { label: 'Ошибка', tone: 'error' }
};
export const isReportBusy = (status: string): boolean => status === 'queued' || status === 'processing';

export type ReportParamKind = 'deal_type' | 'workflow' | 'int' | 'product' | 'date';

export interface ReportParamDef {
	key: string;
	label: string;
	kind: ReportParamKind;
	hint?: string;
	min?: number;
	max?: number;
	default?: unknown;
	required?: boolean;
}

/** Параметры, которые реально читают билдеры отчётов (остальные шаблоны параметров не имеют). */
export const REPORT_PARAMS: Record<string, ReportParamDef[]> = {
	deal_funnel: [
		{ key: 'deal_type', label: 'Тип сделки', kind: 'deal_type', default: 'b2b', required: true },
		{ key: 'workflow_id', label: 'Воронка', kind: 'workflow', hint: 'Пусто — воронка по умолчанию для типа сделки' }
	],
	monthly_dynamics: [{ key: 'months', label: 'Месяцев', kind: 'int', min: 1, max: 36, default: 12, required: true }],
	stuck_deals: [{ key: 'limit', label: 'Не больше строк', kind: 'int', min: 1, max: 5000, default: 500, required: true }],
	// Выгрузка учащихся в LMS: курс и поток, период по дате создания сделки; статусы сделок сервер берёт по умолчанию
	lms_users_upload: [
		{ key: 'product_id', label: 'Курс', kind: 'product', hint: 'Пусто — все курсы' },
		{ key: 'stream_number', label: 'Номер потока', kind: 'int', min: 1, max: 1000, hint: 'Пусто — все потоки' },
		{ key: 'date_from', label: 'Сделки с', kind: 'date' },
		{ key: 'date_to', label: 'Сделки по', kind: 'date' }
	]
};

/** Определения параметров шаблона с учётом `default_params` сервера. */
export function paramsFor(templateCode: string, defaults: Record<string, unknown> = {}): ReportParamDef[] {
	return (REPORT_PARAMS[templateCode] ?? []).map((def) => (def.key in defaults ? { ...def, default: defaults[def.key] } : def));
}

/** Приводит значения формы к телу `POST /reports`: числа зажимаются в границы, пустые убираются. */
const isBlank = (v: unknown): boolean => v == null || v === '';
/** Значение формы или значение по умолчанию, если поле пустое. */
const effective = (def: ReportParamDef, values: Record<string, unknown>): unknown => (isBlank(values[def.key]) ? def.default : values[def.key]);

export function normalizeParams(defs: readonly ReportParamDef[], values: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const def of defs) {
		const raw = effective(def, values);
		if (isBlank(raw)) continue;
		if (def.kind === 'int') {
			const n = Math.trunc(Number(raw));
			if (!Number.isFinite(n)) continue;
			const min = def.min ?? Number.NEGATIVE_INFINITY;
			const max = def.max ?? Number.POSITIVE_INFINITY;
			out[def.key] = Math.min(max, Math.max(min, n));
		} else {
			out[def.key] = String(raw);
		}
	}
	return out;
}

/** Ошибки формы параметров (ключ → текст). */
export function validateParams(defs: readonly ReportParamDef[], values: Record<string, unknown>): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const def of defs) {
		const raw = effective(def, values);
		if (isBlank(raw)) {
			if (def.required) errors[def.key] = 'Обязательное поле';
			continue;
		}
		if (def.kind === 'int') {
			const n = Number(raw);
			if (!Number.isInteger(n)) errors[def.key] = 'Введите целое число';
			else if ((def.min != null && n < def.min) || (def.max != null && n > def.max)) errors[def.key] = `От ${def.min ?? '…'} до ${def.max ?? '…'}`;
		}
	}
	return errors;
}

export interface ReportJobLike {
	status: string;
	expires_at?: string | null;
	finished_at?: string | null;
}

/** Файл готового отчёта удаляется ретеншеном после `expires_at`; отдельного флага у API нет. */
export function isReportExpired(job: ReportJobLike, now: Date = new Date()): boolean {
	if (job.status !== 'completed' || !job.expires_at) return false;
	const expires = Date.parse(job.expires_at);
	return Number.isFinite(expires) && expires <= now.getTime();
}

export const canDownloadReport = (job: ReportJobLike, now: Date = new Date()): boolean => job.status === 'completed' && !isReportExpired(job, now);

// --- Дашборды ---------------------------------------------------------------------

export const WIDGET_TYPES = ['stat_tile', 'report_chart', 'report_table'] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
	stat_tile: 'Показатель',
	report_chart: 'График',
	report_table: 'Таблица'
};

/** Шаблоны, у которых есть `png` — только их можно показать графиком, пока нет JSON-выдачи (см. backend-issues #19). */
export const CHARTABLE_TEMPLATES: ReadonlySet<string> = new Set(['deal_funnel', 'monthly_dynamics']);

export interface WidgetPosition {
	x: number;
	y: number;
	w: number;
	h: number;
}
export const GRID_COLUMNS = 12;
export const WIDGET_WIDTHS: readonly { key: number; value: string }[] = [
	{ key: 4, value: 'Треть' },
	{ key: 6, value: 'Половина' },
	{ key: 12, value: 'Вся ширина' }
];

/** Нормализует произвольный `position` из БД к сетке 12 колонок. */
export function normalizePosition(raw: unknown, index = 0): WidgetPosition {
	const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
	const w = Math.min(GRID_COLUMNS, Math.max(1, Math.round(num(r.w, 6))));
	return {
		x: Math.min(GRID_COLUMNS - w, Math.max(0, Math.round(num(r.x, 0)))),
		y: Math.max(0, Math.round(num(r.y, index))),
		w,
		h: Math.max(1, Math.round(num(r.h, 1)))
	};
}
