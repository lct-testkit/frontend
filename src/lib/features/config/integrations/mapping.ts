// Маппинг «утверждённых полей»: правила «откуда взять, как преобразовать, куда положить». Здесь — чистая часть редактора: черновик правила, перевод
// в тело PUT и обратно, проверки до отправки, разбор ответов 422 сервера, разбор образца запроса. Применяет маппинг и проверяет сам сервер
// (предпросмотр принимает черновик), поэтому второй реализации «что получится» на клиенте нет — она расходилась бы с приёмом.
import type { FieldMapping, MappingRule } from '../types';

export type Transform = MappingRule['transform'];
export type MappingMode = FieldMapping['mode'];

export const TRANSFORMS: readonly { key: Transform; value: string; hint: string }[] = [
	{ key: 'none', value: 'Как есть', hint: 'Значение берётся без изменений' },
	{ key: 'trim', value: 'Убрать пробелы по краям', hint: 'Лишние пробелы в начале и в конце убираются' },
	{ key: 'lower', value: 'В нижний регистр', hint: 'Удобно для email' },
	{ key: 'upper', value: 'В верхний регистр', hint: 'Все буквы заглавные' },
	{ key: 'value_map', value: 'Заменить значения', hint: 'Таблица «что пришло → что записать», например код курса сайта на код курса CRM' },
	{ key: 'template', value: 'Вставить в шаблон', hint: 'Текст со словом {value} на месте значения: «Кампания: {value}»' },
	{ key: 'join', value: 'Склеить несколько полей', hint: 'Значения перечисленных полей через пробел, например фамилия и имя' },
	{ key: 'constant', value: 'Постоянное значение', hint: 'Всегда одно и то же, независимо от запроса' }
];

export const MODES: readonly { key: MappingMode; label: string; hint: string }[] = [
	{ key: 'strict', label: 'Только перечисленные поля', hint: 'Остальные ключи запроса игнорируются' },
	{ key: 'passthrough', label: 'Перечисленные и встроенные названия', hint: 'Остальные ключи разбираются по встроенным названиям (английским и русским)' }
];

/** Особая цель выбора: поле сделки, заведённое администратором (`custom_fields.<код>`). */
export const CUSTOM_TARGET = '__custom';
const CUSTOM_PREFIX = 'custom_fields.';

/** Ключ запроса в сравнимом виде — как на сервере: `НОМЕР  ЗАЯВКИ`, `номер_заявки` и `Номер-Заявки` совпадают. */
export function canonicalKey(key: unknown): string {
	return String(key)
		.normalize('NFKC')
		.trim()
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[\s\-_]+/g, '_');
}

export interface RuleDraft {
	/** ключ для списка в интерфейсе (на сервер не уходит) */
	uid: number;
	/** код цели, `CUSTOM_TARGET` или `null`, пока не выбрано */
	target: string | null;
	/** код пользовательского поля, когда цель — `CUSTOM_TARGET` */
	custom: string;
	source: string;
	/** для «склеить»: по одному ключу в строке */
	sources: string;
	transform: Transform;
	required: boolean;
	defaultValue: string;
	/** по паре в строке: «что пришло = что записать» */
	valueMap: string;
	template: string;
	constant: string;
}

let nextUid = 1;

export function emptyDraft(): RuleDraft {
	return { uid: nextUid++, target: null, custom: '', source: '', sources: '', transform: 'none', required: false, defaultValue: '', valueMap: '', template: '', constant: '' };
}

const text = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v));

export function stringifyValueMap(map: Record<string, string> | null | undefined): string {
	return Object.entries(map ?? {})
		.map(([k, v]) => `${k} = ${v}`)
		.join('\n');
}

/** Строки вида «что пришло = что записать»; пустые пропускаются, строка без «=» — ошибка с номером. */
export function parseValueMap(raw: string): { map: Record<string, string>; error: string | null } {
	const map: Record<string, string> = {};
	const lines = raw.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		const at = line.indexOf('=');
		const from = at < 0 ? '' : line.slice(0, at).trim();
		if (at < 0 || !from) return { map, error: `Строка ${i + 1}: нужен вид «что пришло = что записать»` };
		map[from] = line.slice(at + 1).trim();
	}
	return { map, error: null };
}

export function ruleToDraft(rule: MappingRule): RuleDraft {
	const custom = rule.target.startsWith(CUSTOM_PREFIX);
	return {
		...emptyDraft(),
		target: custom ? CUSTOM_TARGET : rule.target,
		custom: custom ? rule.target.slice(CUSTOM_PREFIX.length) : '',
		source: rule.source ?? '',
		sources: (rule.sources ?? []).join('\n'),
		transform: rule.transform ?? 'none',
		required: rule.required ?? false,
		defaultValue: text(rule.default),
		valueMap: stringifyValueMap(rule.value_map),
		template: rule.template ?? '',
		constant: text(rule.constant)
	};
}

export const targetOf = (d: RuleDraft): string => (d.target === CUSTOM_TARGET ? `${CUSTOM_PREFIX}${d.custom.trim()}` : (d.target ?? ''));

export function draftToRule(d: RuleDraft): MappingRule {
	const rule: MappingRule = { target: targetOf(d), transform: d.transform, required: d.required };
	if (d.transform === 'join') rule.sources = d.sources.split('\n').map((s) => s.trim()).filter(Boolean);
	else if (d.transform !== 'constant') rule.source = d.source.trim();
	if (d.transform === 'value_map') rule.value_map = parseValueMap(d.valueMap).map;
	if (d.transform === 'template') rule.template = d.template;
	if (d.transform === 'constant') rule.constant = d.constant;
	if (d.defaultValue.trim()) rule.default = d.defaultValue.trim();
	return rule;
}

export function toMapping(drafts: readonly RuleDraft[], mode: MappingMode): FieldMapping {
	return { version: 1, mode, rules: drafts.map(draftToRule) };
}

export type RuleErrors = Partial<Record<'target' | 'source' | 'sources' | 'value_map' | 'template' | 'constant', string>>;

/** Проверки до отправки: то, что сервер всё равно отклонит, видно под полем сразу. */
export function validateDrafts(drafts: readonly RuleDraft[]): RuleErrors[] {
	return drafts.map((d) => {
		const e: RuleErrors = {};
		if (!d.target) e.target = 'Выберите поле CRM';
		else if (d.target === CUSTOM_TARGET && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(d.custom.trim())) e.target = 'Код поля: латиница, цифры и «_»';
		if (d.transform === 'join') {
			if (d.sources.split('\n').filter((s) => s.trim()).length < 2) e.sources = 'Укажите не меньше двух ключей, по одному в строке';
		} else if (d.transform !== 'constant' && !d.source.trim()) e.source = 'Укажите ключ в запросе';
		if (d.transform === 'value_map') {
			const parsed = parseValueMap(d.valueMap);
			if (parsed.error) e.value_map = parsed.error;
			else if (!Object.keys(parsed.map).length) e.value_map = 'Добавьте хотя бы одну замену';
		}
		if (d.transform === 'template') {
			if (!d.template) e.template = 'Введите шаблон';
			else if (/[{}]/.test(d.template.replaceAll('{value}', ''))) e.template = 'Допустима только подстановка {value}';
		}
		if (d.transform === 'constant' && !d.constant.trim()) e.constant = 'Введите значение';
		return e;
	});
}

/** В правилах нет ни email, ни телефона: сервер откажет при сохранении, а заявки без контакта отклоняются при приёме. */
export const lacksContact = (drafts: readonly RuleDraft[]): boolean => !drafts.some((d) => d.target === 'email' || d.target === 'phone');

const RULE_FIELDS = new Set<string>(['target', 'source', 'sources', 'value_map', 'template', 'constant']);

export interface ServerIssues {
	byRule: Record<number, RuleErrors>;
	form: string[];
}

/** Ответ 422 сервера: `rules[2].target` и т. п. → под поле нужного правила; остальное — общим списком. */
export function mapServerIssues(issues: readonly { field: string; reason: string }[], drafts: readonly RuleDraft[]): ServerIssues {
	const out: ServerIssues = { byRule: {}, form: [] };
	for (const issue of issues) {
		const m = /^rules\[(\d+)\](?:\.(\w+))?/.exec(issue.field);
		if (m) {
			const index = Number(m[1]);
			const key = (m[2] ?? 'target') as keyof RuleErrors;
			(out.byRule[index] ??= {})[RULE_FIELDS.has(key) ? key : 'target'] = issue.reason;
			continue;
		}
		const custom = /^custom_fields\.(.+)$/.exec(issue.field);
		const at = custom ? drafts.findIndex((d) => d.target === CUSTOM_TARGET && d.custom.trim() === custom[1]) : -1;
		if (at >= 0) (out.byRule[at] ??= {}).target = issue.reason;
		else out.form.push(issue.field && issue.field !== 'rules' ? `${issue.field}: ${issue.reason}` : issue.reason);
	}
	return out;
}

export const SAMPLE_LIMIT = 20 * 1024;

export type SampleResult = { state: 'empty' } | { state: 'error'; message: string } | { state: 'ok'; record: Record<string, unknown> };

/** Образец запроса из текстового поля: пусто, не JSON, слишком большой, не объект — или объект. */
export function parseSample(raw: string): SampleResult {
	if (!raw.trim()) return { state: 'empty' };
	if (new Blob([raw]).size > SAMPLE_LIMIT) return { state: 'error', message: 'Пример больше 20 КБ' };
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return { state: 'error', message: 'Это не JSON: проверьте скобки и кавычки' };
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) return { state: 'error', message: 'Ожидается один объект вида { "ключ": "значение" }' };
	return { state: 'ok', record: value as Record<string, unknown> };
}

/** Типовая заявка с сайта: русские и английские ключи, как в выгрузке «Данные оплат» и в заявках CMS. */
export const TYPICAL_SAMPLE = {
	lead_id: 'lead-1001',
	name: 'Мария Кузнецова',
	phone: '8 926 123-45-67',
	email: 'kuznetsova@example.com',
	product_interest: 'python-basics',
	source_campaign: 'yandex-direct',
	submitted_at: '2026-10-18T08:12:00Z'
};

/** Ключи образца, которые не использует ни одно правило (по сравнимому виду). */
export function unusedKeys(sampleKeys: readonly string[], drafts: readonly RuleDraft[]): string[] {
	const used = new Set<string>();
	for (const d of drafts) for (const s of [d.source, ...d.sources.split('\n')]) if (s.trim()) used.add(canonicalKey(s));
	return sampleKeys.filter((k) => !used.has(canonicalKey(k)));
}

/** Какие ключи образца похожи на цель: совпадают с её кодом или названием («phone», «Телефон»). */
export function suggestSources(sampleKeys: readonly string[], targetCode: string | null, targetLabel: string | undefined): string[] {
	if (!targetCode) return [];
	const wanted = new Set([canonicalKey(targetCode), ...(targetLabel ? [canonicalKey(targetLabel)] : [])]);
	return sampleKeys.filter((k) => wanted.has(canonicalKey(k)));
}
