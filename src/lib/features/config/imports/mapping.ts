// Импорт каталогов: целевые поля, автоподбор маппинга (зеркало backend/app/modules/imports/{fields,mapping}.py),
// проверка маппинга, пресеты, фазы задания.

export const IMPORT_ENTITIES = ['organization', 'product'] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];
export const IMPORT_ENTITY_LABELS: Record<ImportEntity, { label: string; plural: string; hint: string }> = {
	organization: { label: 'Организации', plural: 'организаций', hint: 'Вузы и компании; ключ — ИНН' },
	product: { label: 'Продукты', plural: 'продуктов', hint: 'Курсы и программы; ключ — код продукта' }
};

export const IMPORT_MODES = ['upsert', 'insert', 'update'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];
export const IMPORT_MODE_LABELS: Record<ImportMode, { label: string; hint: string }> = {
	upsert: { label: 'Создать и обновить', hint: 'Новые записи создаются, существующие обновляются по ключу' },
	insert: { label: 'Только создать', hint: 'Существующие записи пропускаются' },
	update: { label: 'Только обновить', hint: 'Строки без существующей записи считаются ошибкой' }
};

export const SOURCE_FORMATS = ['xlsx', 'xls', 'csv'] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];
export const IMPORT_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 100_000;
export const IMPORT_ACCEPT: Record<string, string[]> = {
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
	'application/vnd.ms-excel': ['.xls'],
	'text/csv': ['.csv']
};

/** Формат по расширению файла; `null` — формат не поддерживается. */
export function sourceFormatFromName(fileName: string): SourceFormat | null {
	const ext = fileName.toLowerCase().split('.').pop() ?? '';
	return (SOURCE_FORMATS as readonly string[]).includes(ext) ? (ext as SourceFormat) : null;
}

export type ImportFieldKind =
	| 'text' | 'int' | 'decimal' | 'bool' | 'date' | 'email' | 'phone'
	| 'inn' | 'kpp' | 'ogrn' | 'region_code' | 'direction_code' | 'org_type' | 'format';

export interface ImportFieldSpec {
	target: string;
	label: string;
	kind: ImportFieldKind;
	required: boolean;
}

const f = (target: string, label: string, kind: ImportFieldKind, required = false): ImportFieldSpec => ({ target, label, kind, required });

export const ORGANIZATION_FIELDS: readonly ImportFieldSpec[] = [
	f('name', 'Наименование', 'text', true),
	f('short_name', 'Краткое наименование', 'text'),
	f('org_type', 'Тип организации', 'org_type'),
	f('inn', 'ИНН', 'inn'),
	f('kpp', 'КПП', 'kpp'),
	f('ogrn', 'ОГРН', 'ogrn'),
	f('legal_address', 'Юридический адрес', 'text'),
	f('actual_address', 'Фактический адрес', 'text'),
	f('region_code', 'Код региона', 'region_code'),
	f('website', 'Сайт', 'text'),
	f('main_phone', 'Телефон', 'phone'),
	f('main_email', 'Email', 'email'),
	f('students_count', 'Количество студентов', 'int')
];

export const PRODUCT_FIELDS: readonly ImportFieldSpec[] = [
	f('code', 'Код', 'text', true),
	f('name', 'Наименование', 'text', true),
	f('description', 'Описание', 'text'),
	f('direction_code', 'Код направления', 'direction_code'),
	f('duration_hours', 'Длительность, часы', 'int'),
	f('format', 'Формат', 'format'),
	f('base_price', 'Цена', 'decimal'),
	f('currency', 'Валюта', 'text')
];

const NATURAL_KEYS: Record<ImportEntity, string> = { organization: 'inn', product: 'code' };

export function fieldsFor(entity: ImportEntity): readonly ImportFieldSpec[] {
	return entity === 'organization' ? ORGANIZATION_FIELDS : PRODUCT_FIELDS;
}
export function naturalKeyFor(entity: ImportEntity): string {
	return NATURAL_KEYS[entity];
}

/** Значение «не импортировать колонку» в Select маппинга. */
export const SKIP_TARGET = '';

// --- Автоподбор ----------------------------------------------------------------

const SYNONYMS: Record<string, string> = {
	наименование: 'name',
	название: 'name',
	'полное наименование': 'name',
	организация: 'name',
	вуз: 'name',
	'краткое наименование': 'short_name',
	'сокращённое наименование': 'short_name',
	'сокращенное наименование': 'short_name',
	инн: 'inn',
	кпп: 'kpp',
	огрн: 'ogrn',
	'юридический адрес': 'legal_address',
	адрес: 'legal_address',
	'фактический адрес': 'actual_address',
	сайт: 'website',
	'веб-сайт': 'website',
	телефон: 'main_phone',
	email: 'main_email',
	'e-mail': 'main_email',
	почта: 'main_email',
	'количество студентов': 'students_count',
	'число студентов': 'students_count',
	контингент: 'students_count',
	код: 'code',
	продукт: 'name',
	направление: 'direction_code',
	формат: 'format',
	цена: 'base_price',
	стоимость: 'base_price',
	валюта: 'currency',
	длительность: 'duration_hours',
	часы: 'duration_hours'
};

export const normalizeHeader = (header: string): string => header.trim().toLowerCase().split(/\s+/).join(' ');

export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (!a) return b.length;
	if (!b) return a.length;
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i, ...new Array<number>(b.length).fill(0)];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
		}
		previous = current;
	}
	return previous[b.length];
}

function bestFuzzyMatch(header: string, candidates: readonly ImportFieldSpec[]): ImportFieldSpec | null {
	const normalized = normalizeHeader(header);
	let best: { distance: number; spec: ImportFieldSpec } | null = null;
	for (const spec of candidates) {
		for (const candidate of [spec.target, spec.label.toLowerCase()]) {
			const distance = levenshtein(normalized, candidate.toLowerCase());
			const threshold = Math.max(1, Math.floor(candidate.length / 3));
			if (distance <= threshold && (best === null || distance < best.distance)) best = { distance, spec };
		}
	}
	return best?.spec ?? null;
}

/** `{колонка файла: код поля}` только для колонок, которым нашлось соответствие (как `suggest_mapping` на сервере). */
export function suggestMapping(headers: readonly string[], fields: readonly ImportFieldSpec[]): Record<string, string> {
	const mapping: Record<string, string> = {};
	const used = new Set<string>();
	for (const header of headers) {
		const normalized = normalizeHeader(header);
		const target = SYNONYMS[normalized] ?? fields.find((s) => s.target === normalized)?.target;
		if (target && !used.has(target) && fields.some((s) => s.target === target)) {
			mapping[header] = target;
			used.add(target);
		}
	}
	let remaining = fields.filter((s) => !used.has(s.target));
	for (const header of headers) {
		if (header in mapping) continue;
		const match = bestFuzzyMatch(header, remaining);
		if (match) {
			mapping[header] = match.target;
			used.add(match.target);
			remaining = remaining.filter((s) => s.target !== match.target);
		}
	}
	return mapping;
}

// --- Проверка и пресеты ---------------------------------------------------------

export interface MappingCheck {
	errors: string[];
	warnings: string[];
	/** Колонки файла без соответствия — будут пропущены. */
	unmappedHeaders: string[];
	/** Поля системы, выбранные для нескольких колонок. */
	duplicateTargets: string[];
	/** Обязательные поля сущности без колонки. */
	missingRequired: string[];
	ok: boolean;
}

/** Локальная проверка перед `PUT /mapping`: ключевое поле, дубли, обязательные поля. */
export function checkMapping(mapping: Record<string, string>, headers: readonly string[], entity: ImportEntity): MappingCheck {
	const fields = fieldsFor(entity);
	const byTarget = new Map(fields.map((s) => [s.target, s] as const));
	const active = Object.entries(mapping).filter(([header, target]) => target && headers.includes(header));
	const targets = active.map(([, target]) => target);

	const errors: string[] = [];
	const warnings: string[] = [];
	const unknown = targets.filter((t) => !byTarget.has(t));
	if (unknown.length) errors.push(`Неизвестные поля: ${unknown.join(', ')}`);

	const counts = new Map<string, number>();
	for (const t of targets) counts.set(t, (counts.get(t) ?? 0) + 1);
	const duplicateTargets = [...counts].filter(([, n]) => n > 1).map(([t]) => t);
	for (const t of duplicateTargets) errors.push(`Поле «${byTarget.get(t)?.label ?? t}» выбрано для нескольких колонок`);

	const key = naturalKeyFor(entity);
	if (!targets.includes(key)) errors.push(`Не выбрана колонка для ключевого поля «${byTarget.get(key)?.label ?? key}»`);

	const missingRequired = fields.filter((s) => s.required && !targets.includes(s.target)).map((s) => s.target);
	for (const t of missingRequired) {
		if (t !== key) warnings.push(`Обязательное поле «${byTarget.get(t)?.label ?? t}» не сопоставлено — строки без него будут отклонены при проверке`);
	}

	const unmappedHeaders = headers.filter((h) => !mapping[h]);
	return { errors, warnings, unmappedHeaders, duplicateTargets, missingRequired, ok: errors.length === 0 };
}

/** Накладывает пресет на текущий маппинг: берутся только колонки, которые есть в файле; занятые поля не дублируются. */
export function applyPreset(current: Record<string, string>, preset: Record<string, string>, headers: readonly string[]): Record<string, string> {
	const result: Record<string, string> = { ...current };
	for (const [header, target] of Object.entries(preset)) {
		if (!headers.includes(header) || !target) continue;
		for (const [h, t] of Object.entries(result)) if (t === target && h !== header) delete result[h];
		result[header] = target;
	}
	return result;
}

/** Первые `limit` различных непустых значений колонки для подсказки в маппинге. */
export function sampleValues(rows: readonly (readonly string[])[], columnIndex: number, limit = 3): string[] {
	const seen: string[] = [];
	for (const row of rows) {
		const value = (row[columnIndex] ?? '').trim();
		if (value && !seen.includes(value)) {
			seen.push(value);
			if (seen.length >= limit) break;
		}
	}
	return seen;
}

// --- Статусы задания -----------------------------------------------------------------

export const IMPORT_JOB_STATUSES = [
	'uploaded', 'mapped', 'validated', 'applying', 'completed', 'completed_with_errors', 'rolling_back', 'rolled_back', 'failed'
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

/** Подпись, тон и шаг мастера (0 — файл, 1 — маппинг, 2 — проверка, 3 — применение, 4 — готово). */
export const IMPORT_JOB_STATUS_INFO: Record<ImportJobStatus, { label: string; tone: Tone; step: number }> = {
	uploaded: { label: 'Файл загружен', tone: 'neutral', step: 1 },
	mapped: { label: 'Колонки сопоставлены', tone: 'info', step: 2 },
	validated: { label: 'Проверен', tone: 'info', step: 2 },
	applying: { label: 'Применяется', tone: 'info', step: 3 },
	completed: { label: 'Завершён', tone: 'success', step: 4 },
	completed_with_errors: { label: 'Завершён с ошибками', tone: 'warning', step: 4 },
	rolling_back: { label: 'Откатывается', tone: 'info', step: 4 },
	rolled_back: { label: 'Откачен', tone: 'neutral', step: 4 },
	failed: { label: 'Не удалось', tone: 'error', step: 4 }
};

export const importStep = (status: string): number => IMPORT_JOB_STATUS_INFO[status as ImportJobStatus]?.step ?? 0;
export const isImportBusy = (status: string): boolean => status === 'applying' || status === 'rolling_back';
export const canRollbackImport = (job: { status: string; rollback_available: boolean }): boolean =>
	job.rollback_available && (job.status === 'completed' || job.status === 'completed_with_errors');
export const canApplyImport = (job: { status: string; ok_rows: number; warn_rows: number }): boolean =>
	job.status === 'validated' && job.ok_rows + job.warn_rows > 0;
