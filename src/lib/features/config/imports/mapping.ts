// Импорт: режимы, форматы, подписи типов, проверка сопоставления, пресеты, фазы задания.
// Поля типов и автоподбор колонок приходят с сервера (`GET /api/imports/entity-types`, `suggested_mapping` профиля):
// копий списков полей и синонимов здесь нет — они уже расходились с бэкендом при каждом новом типе.
import type { components } from '$lib/api';

export type ImportEntityType = components['schemas']['ImportEntityTypeOut'];
export type ImportFieldSpec = components['schemas']['ImportFieldOut'];
/** Код типа сущности (`organization`, `vendor_contact`, …) в схеме создания задания. */
export type ImportEntity = components['schemas']['ImportJobCreateRequest']['entity_type'];

/** Короткая подпись и подсказка для списка и мастера; для неизвестного серверу типа берётся его собственная подпись. */
export const IMPORT_ENTITY_INFO: Record<string, { label: string; plural: string; hint: string }> = {
	organization: { label: 'Организации', plural: 'организаций', hint: 'Вузы и компании; ключ — ИНН' },
	product: { label: 'Продукты', plural: 'продуктов', hint: 'Курсы и программы; ключ — код продукта' },
	license: { label: 'Лицензии', plural: 'лицензий', hint: 'Договоры вуз — вендор — программное обеспечение' },
	vendor_contact: { label: 'Вендоры', plural: 'вендоров', hint: 'Компания, продукты и ответственные — файл «Вендоры»' },
	payment: { label: 'Оплаты', plural: 'оплат', hint: 'Оплаченные заказы физлиц: заявка, курс, поток — «Данные оплат»' },
	learner: { label: 'Учащиеся LMS', plural: 'учащихся', hint: 'Шаблон LMS «Загрузка пользователей» с паспортом и дипломом' }
};

export const entityInfo = (type: Pick<ImportEntityType, 'code' | 'label'>): { label: string; hint: string } => {
	const known = IMPORT_ENTITY_INFO[type.code];
	return known ? { label: known.label, hint: known.hint } : { label: type.label, hint: '' };
};

export const IMPORT_MODES = ['upsert', 'insert', 'update'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];
export const IMPORT_MODE_LABELS: Record<ImportMode, { label: string; hint: string }> = {
	upsert: { label: 'Создать и обновить', hint: 'Новые записи создаются, существующие обновляются по ключу' },
	insert: { label: 'Только создать', hint: 'Существующие записи пропускаются' },
	update: { label: 'Только обновить', hint: 'Строки без существующей записи считаются ошибкой' }
};

export const SOURCE_FORMATS = ['xlsx', 'xls', 'csv', 'json'] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];
export const IMPORT_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 100_000;
export const IMPORT_ACCEPT: Record<string, string[]> = {
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
	'application/vnd.ms-excel': ['.xls'],
	'text/csv': ['.csv'],
	'application/json': ['.json']
};

/** Формат по расширению файла; `null` — формат не поддерживается. */
export function sourceFormatFromName(fileName: string): SourceFormat | null {
	const ext = fileName.toLowerCase().split('.').pop() ?? '';
	return (SOURCE_FORMATS as readonly string[]).includes(ext) ? (ext as SourceFormat) : null;
}

/** Значение «не импортировать колонку» в Select маппинга. */
export const SKIP_TARGET = '';

// --- Проверка и пресеты ---------------------------------------------------------

export interface MappingCheck {
	errors: string[];
	/** Что ещё нужно сопоставить, чтобы строки можно было применить (те же названия, что в ответе сервера при сохранении). */
	missing: string[];
	/** Колонки файла без соответствия — будут пропущены. */
	unmappedHeaders: string[];
	/** Поля системы, выбранные для нескольких колонок. */
	duplicateTargets: string[];
	ok: boolean;
}

// Те же формулировки, что в `imports/fields.py::missing_mapping_labels`: сервер сверяет ими и отвечает 422 при сохранении.
const NAME_REQUIREMENT = 'ФИО (или Фамилия и Имя)';
const CONTACT_REQUIREMENT = 'Email или Телефон';

/** Чего не хватает в сопоставлении: обязательные поля типа, а для типов про людей — имя и способ связи. */
export function missingRequirements(targets: readonly string[], type: ImportEntityType): string[] {
	const has = (t: string) => targets.includes(t);
	const known = new Set(type.fields.map((f) => f.target));
	const missing = type.fields.filter((f) => f.required && !has(f.target)).map((f) => f.label);
	// Тип «про людей» — тот, где есть поля контакта: у него имя и email/телефон нужны независимо от флагов `required`.
	if (known.has('email') && known.has('phone') && (known.has('full_name') || known.has('last_name'))) {
		if (!(has('full_name') || (has('last_name') && has('first_name')))) missing.push(NAME_REQUIREMENT);
		if (!(has('email') || has('phone'))) missing.push(CONTACT_REQUIREMENT);
	}
	return missing;
}

/** Локальная проверка перед `PUT /mapping`: неизвестные поля, дубли, чего не хватает для применения. */
export function checkMapping(mapping: Record<string, string>, headers: readonly string[], type: ImportEntityType | null): MappingCheck {
	if (!type) return { errors: [], missing: [], unmappedHeaders: [...headers], duplicateTargets: [], ok: false };
	const byTarget = new Map(type.fields.map((s) => [s.target, s] as const));
	const active = Object.entries(mapping).filter(([header, target]) => target && headers.includes(header));
	const targets = active.map(([, target]) => target);

	const errors: string[] = [];
	const unknown = targets.filter((t) => !byTarget.has(t));
	if (unknown.length) errors.push(`Неизвестные поля: ${unknown.join(', ')}`);

	const counts = new Map<string, number>();
	for (const t of targets) counts.set(t, (counts.get(t) ?? 0) + 1);
	const duplicateTargets = [...counts].filter(([, n]) => n > 1).map(([t]) => t);
	for (const t of duplicateTargets) errors.push(`Поле «${byTarget.get(t)?.label ?? t}» выбрано для нескольких колонок`);

	const missing = missingRequirements(targets, type);
	const unmappedHeaders = headers.filter((h) => !mapping[h]);
	return { errors, missing, unmappedHeaders, duplicateTargets, ok: errors.length === 0 && missing.length === 0 };
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

// --- Строки результата ---------------------------------------------------------------

/** Статусы строки (`GET /imports/{id}/rows`): подпись и тон. */
export const IMPORT_ROW_STATUS_INFO: Record<string, { label: string; tone: Tone }> = {
	ok: { label: 'Без замечаний', tone: 'success' },
	warn: { label: 'Предупреждение', tone: 'warning' },
	error: { label: 'Ошибка', tone: 'error' },
	skipped: { label: 'Пропущена', tone: 'neutral' },
	rolled_back: { label: 'Откачена', tone: 'neutral' },
	rollback_blocked: { label: 'Откат заблокирован', tone: 'warning' }
};
export const rowStatus = (status: string): { label: string; tone: Tone } => IMPORT_ROW_STATUS_INFO[status] ?? { label: status, tone: 'neutral' };
