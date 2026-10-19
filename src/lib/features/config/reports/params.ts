// Отчёты и дашборды: параметры шаблонов (backend/app/modules/reporting/spec.py), подписи, срок хранения.
import { GLOSSARY } from '$lib/ui/glossary';
import { TRANSFER_STATUS_LABELS } from '../../crm/shared/labels';

/** Форматы, которые умеет бэкенд (порядок — как на экране). */
const REPORT_FORMATS = ['xlsx', 'xls', 'pdf', 'png', 'json'] as const;
/** Неизвестный серверу формат из будущего не ломает типы: он показывается кодом в верхнем регистре. */
export type ReportFormat = (typeof REPORT_FORMATS)[number] | (string & {});
const REPORT_FORMAT_LABELS: Record<string, string> = { xlsx: 'Excel .xlsx', xls: 'Excel .xls', pdf: 'PDF', png: 'PNG', json: 'JSON' };
const REPORT_FORMAT_HINTS: Record<string, string> = {
	xlsx: 'Для Excel 2007 и новее',
	xls: 'Для Excel 97–2003 и старых программ',
	pdf: 'Для печати и передачи',
	png: 'Картинка диаграммы',
	json: 'Данные для обмена с другими системами'
};

export const formatLabel = (code: string): string => REPORT_FORMAT_LABELS[code] ?? code.toUpperCase();
export const formatHint = (code: string): string | undefined => REPORT_FORMAT_HINTS[code];

/** Форматы шаблона: известные в каноническом порядке, за ними неизвестные (формат бэкенда не теряем). */
export function formatsFor(outputFormats: readonly string[]): string[] {
	const known = (REPORT_FORMATS as readonly string[]).filter((f) => outputFormats.includes(f));
	return [...known, ...outputFormats.filter((f) => !(REPORT_FORMATS as readonly string[]).includes(f))];
}

/** Формат по умолчанию: запомненный (если он есть у шаблона), иначе xlsx, иначе первый. */
export function defaultFormat(formats: readonly string[], remembered?: string | null): string {
	if (remembered && formats.includes(remembered)) return remembered;
	return formats.includes('xlsx') ? 'xlsx' : (formats[0] ?? 'xlsx');
}

export type ReportStatus = 'queued' | 'processing' | 'completed' | 'failed';
export const REPORT_STATUS_INFO: Record<ReportStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'error' }> = {
	queued: { label: 'В очереди', tone: 'neutral' },
	processing: { label: 'Формируется', tone: 'info' },
	completed: { label: 'Готов', tone: 'success' },
	failed: { label: 'Ошибка', tone: 'error' }
};
export const isReportBusy = (status: string): boolean => status === 'queued' || status === 'processing';

export type ReportParamKind =
	| 'deal_type'
	| 'workflow'
	| 'int'
	| 'product'
	| 'date'
	| 'date_field'
	| 'organization_multi'
	| 'direction_multi'
	| 'product_multi'
	| 'owner_multi'
	| 'text_list'
	| 'enum'
	| 'enum_multi'
	| 'bool'
	| 'columns';

export interface ReportParamOption {
	key: string;
	value: string;
	/** колонка входит в набор по умолчанию (`kind: 'columns'`) */
	default?: boolean;
}

export interface ReportParamDef {
	key: string;
	label: string;
	kind: ReportParamKind;
	hint?: string;
	min?: number;
	max?: number;
	default?: unknown;
	required?: boolean;
	/** варианты для `enum`, `enum_multi`, `date_field` */
	options?: readonly ReportParamOption[];
	/** поле блокируется (и не уходит в тело), если заполнен любой из этих ключей */
	disabledBy?: readonly string[];
	disabledHint?: string;
	/** колонки «как в ТЗ» (`kind: 'columns'`) */
	tz?: readonly string[];
	/** поле общего блока «период + вуз + направление + продукт + ответственный» */
	group?: 'scope';
}

// --- Подписи периода --------------------------------------------------------------------------

/** По какой дате считается период: ключи — `date_fields` шаблона (`GET /api/report-templates`). */
const DATE_FIELD_LABELS: Record<string, string> = {
	created_at: 'Сделка создана',
	closed_at: 'Сделка закрыта',
	updated_at: 'Сделка изменена',
	last_activity_at: 'Последняя активность учащегося',
	enrolled_at: 'Учащийся зачислен',
	completed_at: 'Учащийся завершил обучение',
	license_signed_at: 'Лицензия подписана'
};
const dateFieldLabel = (key: string): string => DATE_FIELD_LABELS[key] ?? key;

const DEAL_DATES = ['created_at', 'closed_at', 'updated_at'] as const;

// --- Описание шаблонов ------------------------------------------------------------------------

export interface ReportScope {
	/** `null` — периода нет; массив — допустимые `date_field` (пустой — выбор даты запрещён сервером) */
	period: readonly string[] | null;
	organizations: boolean;
	directions: boolean;
	products: boolean;
	owners: boolean;
}

export interface ReportSpec {
	/** какие общие фильтры читает builder и по каким датам считается период */
	scope: ReportScope;
	/** поля отчёта ПЕРЕД общим блоком (тип сделки, число месяцев) */
	extra: ReportParamDef[];
	/** поля отчёта ПОСЛЕ общего блока (лимит строк) */
	tail?: ReportParamDef[];
	/** одна строка над формой: что именно считает отчёт */
	hint?: string;
	/** подсказка видна только этим ролям (иначе всем) */
	hintRoles?: readonly string[];
	/** отчёт содержит персональные данные: предупреждение над формой */
	personalData?: boolean;
	/** другая подпись поля «Ответственные» */
	ownersLabel?: string;
	/** у шаблона есть выбор колонок (если сервер отдал `columns`) */
	columns?: boolean;
	/** колонки «как в ТЗ» (ключи каталога): кнопка в блоке выбора колонок */
	tzColumns?: readonly string[];
}

const ALL_FILTERS = { organizations: true, directions: true, products: true, owners: true } as const;
const limitDef = (def: number): ReportParamDef => ({ key: 'limit', label: 'Максимум строк в отчёте', hint: 'Если записей больше, в файл попадут первые — от 1 до 5000', kind: 'int', min: 1, max: 5000, default: def, required: true });

/** Два способа задать срок — последние N месяцев или свой период — стоят рядом, и подпись каждого говорит, что сработает: заданный период главнее числа месяцев. */
const MONTHS_DEF: ReportParamDef = {
	key: 'months',
	label: 'Последних месяцев',
	kind: 'int',
	min: 1,
	max: 36,
	default: 12,
	required: true,
	hint: 'От 1 до 36. Если ниже выбран свой период, берётся он, а не это число',
	disabledBy: ['date_from', 'date_to'],
	disabledHint: 'Выбран свой период — число месяцев не используется'
};

export const REPORT_SPECS: Record<string, ReportSpec> = {
	deal_funnel: {
		scope: { period: DEAL_DATES, ...ALL_FILTERS },
		extra: [
			{ key: 'deal_type', label: 'Тип сделки', kind: 'deal_type', default: 'b2b', required: true },
			{ key: 'workflow_id', label: 'Воронка', kind: 'workflow', hint: 'Пусто — воронка по умолчанию для типа сделки' }
		],
		hint: 'Без фильтров — снимок не старше 5 минут; с фильтрами — точный расчёт',
		hintRoles: ['ADMIN']
	},
	kam_summary: { scope: { period: DEAL_DATES, ...ALL_FILTERS }, extra: [], ownersLabel: 'КАМы в сводке' },
	region_summary: { scope: { period: DEAL_DATES, ...ALL_FILTERS }, extra: [] },
	loss_reasons: { scope: { period: ['closed_at'], ...ALL_FILTERS }, extra: [], hint: 'Период считается по дате закрытия: в отчёте только проигранные сделки' },
	sla_compliance: {
		scope: { period: DEAL_DATES, ...ALL_FILTERS },
		extra: [],
		hint: 'Состояние SLA берётся на текущий момент среди сделок за период'
	},
	monthly_dynamics: {
		scope: { period: [], ...ALL_FILTERS },
		extra: [MONTHS_DEF]
	},
	stuck_deals: { scope: { period: DEAL_DATES, ...ALL_FILTERS }, extra: [], tail: [limitDef(500)], hint: 'Только сделки с нарушенным SLA. Лишние строки по лимиту отсекаются' },
	deal_register: { scope: { period: DEAL_DATES, ...ALL_FILTERS }, extra: [], tail: [limitDef(1000)], columns: true, tzColumns: ['organization', 'direction', 'product', 'status', 'owner'] },
	learning_progress: {
		scope: { period: ['last_activity_at', 'enrolled_at', 'completed_at'], ...ALL_FILTERS },
		extra: [],
		tail: [limitDef(1000)],
		columns: true,
		personalData: true
	},
	product_demand: {
		scope: { period: DEAL_DATES, ...ALL_FILTERS },
		extra: [
			{
				key: 'level',
				label: 'Группировать по',
				kind: 'enum',
				default: 'product',
				options: [
					{ key: 'product', value: GLOSSARY.product.plural },
					{ key: 'direction', value: GLOSSARY.direction.plural }
				]
			},
			{
				key: 'sort_by',
				label: 'Упорядочить по',
				kind: 'enum',
				default: 'index',
				options: [
					{ key: 'index', value: 'Индексу востребованности' },
					{ key: 'applications', value: 'Числу заявок' },
					{ key: 'learners', value: 'Числу обучающихся' },
					{ key: 'streams', value: 'Числу потоков' }
				]
			},
			{ key: 'top', label: 'Показать первые', kind: 'int', min: 1, max: 100, default: 20, required: true }
		],
	},
	license_register: {
		scope: { period: ['license_signed_at', 'created_at'], organizations: true, directions: false, products: false, owners: false },
		extra: [],
		tail: [
			{ key: 'vendors', label: GLOSSARY.vendor.plural, kind: 'text_list', hint: 'Названия через запятую. Пусто — без ограничения' },
			{ key: 'transfer_statuses', label: 'Статус по передаче', kind: 'enum_multi', hint: 'Отмеченные статусы складываются: подойдёт лицензия с любым из них. Пусто — без ограничения', options: Object.entries(TRANSFER_STATUS_LABELS).map(([key, value]) => ({ key, value })) },
			{ key: 'valid_year', label: 'Год окончания', kind: 'int', min: 2000, max: 2100, hint: 'Пусто — без ограничения' },
			{ key: 'expired', label: 'Только с истёкшим сроком', kind: 'bool' },
			limitDef(1000)
		],
		columns: true,
		tzColumns: ['organization', 'vendor', 'product_name', 'contract_number', 'is_signed', 'license_valid_year', 'transfer_status', 'manager_full_name', 'responsible_contacts', 'comment'],
		personalData: true
	},
	signing_periods: {
		// месяц считается по дате создания документа внутри отчёта: выбора даты периода нет (как у «Динамики по месяцам»)
		scope: { period: [], organizations: false, directions: false, products: false, owners: false },
		extra: [
			{
				key: 'doc_type',
				label: 'Тип документа',
				kind: 'enum',
				options: [
					{ key: 'kp', value: 'Коммерческое предложение' },
					{ key: 'act', value: 'Акт' },
					{ key: 'offer', value: 'Оферта' },
					{ key: 'consent', value: 'Согласие на обработку ПДн' },
					{ key: 'erasure_act', value: 'Акт об уничтожении ПДн' },
					{ key: 'custom', value: 'Прочие документы' }
				]
			},
			MONTHS_DEF
		]
	},
	lms_users_upload: {
		// период по дате создания сделки — тот же общий блок (с быстрыми периодами), что у остальных отчётов
		scope: { period: ['created_at'], organizations: false, directions: false, products: false, owners: false },
		extra: [
			{ key: 'product_id', label: 'Курс', kind: 'product', hint: 'Продукт из справочника. Пусто — без ограничения' },
			{ key: 'stream_number', label: 'Номер потока', kind: 'int', min: 1, max: 1000, hint: 'Пусто — без ограничения' }
		],
		personalData: true,
		hint: 'Статусы сделок берутся автоматически: оплата и зачисление в LMS'
	}
};

/** Описание шаблона без служебного перечня параметров: «Параметры: date_from/date_to, organization_ids …» человеку ни к чему. */
export function describeTemplate(description: string): string {
	return description
		.replace(/\s*Параметры:[^.]*\.?/u, ' ')
		.replace(/без права\s+`?contact:reveal`?/giu, 'без права просмотра персональных данных')
		.replace(/источник\s+lms/giu, 'источник LMS')
		.replace(/\s*\(signature_documents\)/giu, '')
		.replace(/\s+[—-]\s+индекс как среднее доле каждого показателя/giu, '. Индекс — среднее из долей каждого показателя')
		.replace(/Лицензии\/договоры вуз-вендор-ПО:/giu, 'Лицензии и договоры:')
		.replace(/Пусто и без пометки «не реализована», если источник LMS не присылал данных\.?/giu, 'Пусто, если LMS не присылала данные.')
		.replace(/—\s*листинг, не агрегат/giu, '— список сделок, а не сводка')
		.replace(/содержит ПДн/giu, 'содержит персональные данные')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

export const hasSpec = (templateCode: string): boolean => templateCode in REPORT_SPECS;

/** Что известно о шаблоне от сервера: допустимые даты периода переопределяют встроенный список. */
export interface TemplateInfo {
	dateFields?: readonly string[];
	defaultDateField?: string | null;
	/** каталог колонок шаблона (`columns` из `GET /api/report-templates`); пусто — выбор колонок не поддерживается */
	columns?: readonly { key: string; title: string; default: boolean }[];
}

/** Подпись поля периода: «Период» или «Сделка закрыта», если дата одна и зафиксирована. */
function periodLabel(dateFields: readonly string[]): string {
	return dateFields.length === 1 ? dateFieldLabel(dateFields[0]) : 'Период';
}

/** Допустимые даты периода шаблона (сервер, иначе встроенный список). */
function dateFieldsFor(templateCode: string, info?: TemplateInfo): readonly string[] {
	const fromServer = info?.dateFields;
	if (fromServer) return fromServer;
	return REPORT_SPECS[templateCode]?.scope.period ?? [];
}

/** Поля общего блока по `scope` шаблона — их же рисует `ReportScopeFields`. */
export function scopeDefs(spec: ReportSpec, dateFields: readonly string[], defaultDateField?: string | null): ReportParamDef[] {
	const { scope } = spec;
	const defs: ReportParamDef[] = [];
	if (scope.period) {
		if (dateFields.length > 1) {
			defs.push({
				key: 'date_field',
				label: 'Период считать по',
				kind: 'date_field',
				default: defaultDateField ?? dateFields[0],
				options: dateFields.map((key) => ({ key, value: dateFieldLabel(key) })),
				group: 'scope'
			});
		}
		defs.push({ key: 'date_from', label: `${periodLabel(dateFields)} с`, kind: 'date', group: 'scope' }, { key: 'date_to', label: `${periodLabel(dateFields)} по`, kind: 'date', group: 'scope' });
	}
	if (scope.organizations) defs.push({ key: 'organization_ids', label: GLOSSARY.org.plural, kind: 'organization_multi', hint: GLOSSARY.org.hint, group: 'scope' });
	if (scope.directions) defs.push({ key: 'direction_ids', label: GLOSSARY.direction.plural, kind: 'direction_multi', hint: GLOSSARY.direction.hint, group: 'scope' });
	if (scope.products) defs.push({ key: 'product_ids', label: GLOSSARY.product.plural, kind: 'product_multi', hint: GLOSSARY.product.hint, group: 'scope' });
	if (scope.owners) defs.push({ key: 'owner_ids', label: spec.ownersLabel ?? GLOSSARY.deal_owner.plural, kind: 'owner_multi', hint: GLOSSARY.deal_owner.hint, group: 'scope' });
	return defs;
}

/** Поле «Колонки» — только если шаблон умеет и сервер отдал каталог. */
function columnsDefs(spec: ReportSpec, info?: TemplateInfo): ReportParamDef[] {
	if (!spec.columns || !info?.columns?.length) return [];
	const options = info.columns.map((c) => ({ key: c.key, value: c.title, default: c.default }));
	return [{ key: 'columns', label: 'Колонки', kind: 'columns', options, tz: spec.tzColumns, default: options.filter((o) => o.default).map((o) => o.key) }];
}

/**
 * Определения параметров шаблона с учётом `default_params` сервера.
 * Порядок: поля отчёта, общий блок, хвост (лимит). Для кода без описания — пустой список.
 */
export function paramsFor(templateCode: string, defaults: Record<string, unknown> = {}, info?: TemplateInfo): ReportParamDef[] {
	const spec = REPORT_SPECS[templateCode];
	if (!spec) return [];
	const dateFields = dateFieldsFor(templateCode, info);
	const all = [...spec.extra, ...scopeDefs(spec, dateFields, info?.defaultDateField), ...(spec.tail ?? []), ...columnsDefs(spec, info)];
	return all.map((def) => (def.key in defaults ? { ...def, default: defaults[def.key] } : def));
}

// --- Значения формы → тело POST /reports ------------------------------------------------------

const MULTI_KINDS: ReadonlySet<ReportParamKind> = new Set(['organization_multi', 'direction_multi', 'product_multi', 'owner_multi', 'text_list', 'enum_multi']);
const isBlank = (v: unknown): boolean => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** Список значений: массив, либо строка через запятую из старых виджетов; без пустых и повторов. */
export function toList(raw: unknown): string[] {
	const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : raw == null ? [] : [raw];
	return [...new Set(parts.map((p) => String(p).trim()).filter(Boolean))];
}

/** Поле заблокировано другим заполненным полем (`disabledBy`). */
export function isDisabled(def: ReportParamDef, values: Record<string, unknown>): boolean {
	return Boolean(def.disabledBy?.some((key) => !isBlank(values[key])));
}

/** Значение формы или значение по умолчанию, если поле пустое. */
const effective = (def: ReportParamDef, values: Record<string, unknown>): unknown => (isBlank(values[def.key]) ? def.default : values[def.key]);

/** Приводит значения формы к телу `POST /reports`: числа зажимаются в границы, пустые убираются, списки — массивы без повторов. */
export function normalizeParams(defs: readonly ReportParamDef[], values: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const def of defs) {
		if (isDisabled(def, values)) continue;
		const raw = effective(def, values);
		if (isBlank(raw)) continue;
		if (def.kind === 'int') {
			const n = Math.trunc(Number(raw));
			if (!Number.isFinite(n)) continue;
			const min = def.min ?? Number.NEGATIVE_INFINITY;
			const max = def.max ?? Number.POSITIVE_INFINITY;
			out[def.key] = Math.min(max, Math.max(min, n));
		} else if (MULTI_KINDS.has(def.kind)) {
			const list = toList(raw);
			if (list.length) out[def.key] = list;
		} else if (def.kind === 'columns') {
			// только известные ключи (колонку могли убрать на сервере), в порядке выбора; набор по умолчанию в тело не идёт
			const known = new Set((def.options ?? []).map((o) => o.key));
			const list = toList(raw).filter((k) => known.has(k));
			const dflt = Array.isArray(def.default) ? (def.default as string[]) : [];
			const same = list.length === dflt.length && list.every((k, i) => k === dflt[i]);
			if (list.length && !same) out[def.key] = list;
		} else if (def.kind === 'bool') {
			if (raw === true) out[def.key] = true;
		} else if (def.kind === 'date_field') {
			// дату по умолчанию сервер подставит сам: ключ лишний, а запуски разных виджетов должны совпадать
			if (String(raw) !== String(def.default)) out[def.key] = String(raw);
		} else {
			out[def.key] = String(raw);
		}
	}
	return out;
}

export interface ValidateContext {
	/** воронка → тип сделки: воронка должна подходить выбранному типу */
	workflowTypes?: Record<string, string>;
}

/** Ошибки формы параметров (ключ → текст). */
export function validateParams(defs: readonly ReportParamDef[], values: Record<string, unknown>, ctx: ValidateContext = {}): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const def of defs) {
		if (isDisabled(def, values)) continue;
		if (def.kind === 'columns') {
			if (Array.isArray(values[def.key]) && (values[def.key] as unknown[]).length === 0) errors[def.key] = 'Выберите хотя бы одну колонку';
			continue;
		}
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
	const from = values.date_from;
	const to = values.date_to;
	if (typeof from === 'string' && typeof to === 'string' && from && to && from > to && defs.some((d) => d.key === 'date_to')) errors.date_to = 'Дата «по» раньше даты «с»';
	const workflow = values.workflow_id;
	const dealType = values.deal_type ?? defs.find((d) => d.key === 'deal_type')?.default;
	if (typeof workflow === 'string' && workflow && ctx.workflowTypes && typeof dealType === 'string') {
		const type = ctx.workflowTypes[workflow];
		if (type && type !== dealType) errors.workflow_id = 'Воронка относится к другому типу сделки';
	}
	return errors;
}


export interface ReportJobLike {
	status: string;
	expires_at?: string | null;
	finished_at?: string | null;
	/** `null` у готового задания — файла в хранилище нет; не задано — не знаем */
	file_id?: string | null;
}

/** Файл готового отчёта удаляется ретеншеном после `expires_at`. */
export function isReportExpired(job: ReportJobLike, now: Date = new Date()): boolean {
	if (job.status !== 'completed' || !job.expires_at) return false;
	const expires = Date.parse(job.expires_at);
	return Number.isFinite(expires) && expires <= now.getTime();
}

/** Виды отчёта «только файлом»: содержат ПДн целиком, JSON-выдачи (`/data`) у них нет (backend/app/modules/reporting/builders.py: FILE_ONLY_REPORTS). */
export const FILE_ONLY_TEMPLATES: ReadonlySet<string> = new Set(['lms_users_upload']);

/** JSON с данными можно получить у готового отчёта любого вида, кроме «только файлом»; файл при этом не нужен (даже если срок хранения вышел). */
export const canDownloadJson = (job: { status: string; template_code: string }): boolean => job.status === 'completed' && !FILE_ONLY_TEMPLATES.has(job.template_code);

export type FileState = 'pending' | 'ready' | 'expired' | 'gone' | 'failed';

/**
 * Что с файлом отчёта: ждёт (очередь, обработка), готов, срок хранения истёк, файла нет (удалён или не создавался), ошибка.
 * `gone` приходит из сессии: сервер уже ответил 410 на скачивание.
 */
export function fileState(job: ReportJobLike, opts: { now?: Date; gone?: boolean } = {}): FileState {
	if (job.status === 'failed') return 'failed';
	if (job.status !== 'completed') return 'pending';
	if (opts.gone) return 'gone';
	if (isReportExpired(job, opts.now)) return 'expired';
	if (job.file_id === null) return 'gone';
	return 'ready';
}

export const canDownloadReport = (job: ReportJobLike, now: Date = new Date()): boolean => fileState(job, { now }) === 'ready';

// --- Дашборды ---------------------------------------------------------------------

export const WIDGET_TYPES = ['stat_tile', 'report_chart', 'report_table'] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
	stat_tile: 'Показатель',
	report_chart: 'График',
	report_table: 'Таблица'
};

export interface WidgetPosition {
	x: number;
	y: number;
	w: number;
	h: number;
}
const GRID_COLUMNS = 12;
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
