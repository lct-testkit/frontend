// Итог проверки файла простыми словами: что будет сделано (`GET /api/imports/{id}/summary`), какие проблемы сколько раз встретились, замечания строки (`issues`).
import type { components } from '$lib/api';
import { count } from '$lib/utils/format';
import { explainRowErrors, type RowRemark } from './rowErrors';

export type ImportSummary = components['schemas']['ImportSummaryOut'];
export type RowIssue = components['schemas']['RowIssueOut'];
type RowLike = Pick<components['schemas']['ImportRowOut'], 'issues' | 'errors'>;

/** Что сервер называет сущностью в `would` / `applied` → слово в трёх падежных формах. Неизвестный ключ показывается как есть. */
const ENTITY_FORMS: Record<string, [string, string, string]> = {
	license: ['лицензию', 'лицензии', 'лицензий'],
	organization: ['организацию', 'организации', 'организаций'],
	product: ['продукт', 'продукта', 'продуктов'],
	vendor: ['вендора', 'вендоров', 'вендоров'],
	software: ['программу', 'программы', 'программ'],
	contact: ['контакт', 'контакта', 'контактов'],
	deal: ['сделку', 'сделки', 'сделок'],
	direction: ['направление', 'направления', 'направлений'],
	learner: ['учащегося', 'учащихся', 'учащихся']
};

const ACTIONS: { key: 'create' | 'update' | 'skip'; would: string; applied: string }[] = [
	{ key: 'create', would: 'Будет создано', applied: 'Создано' },
	{ key: 'update', would: 'Будет обновлено', applied: 'Обновлено' },
	{ key: 'skip', would: 'Будет пропущено', applied: 'Пропущено' }
];

const entityCount = (entity: string, n: number): string => {
	const forms = ENTITY_FORMS[entity];
	return forms ? count(n, forms) : `${n} (${entity})`;
};

export interface OutcomeLine {
	key: string;
	label: string;
	text: string;
}

/** Строки «Будет создано: 3 лицензии» (проверка) или «Создано: 3 лицензии» (после применения). Нулевые счётчики и пустые группы не показываются. */
export function outcomeLines(map: Record<string, Record<string, number>> | null | undefined, phase: 'would' | 'applied'): OutcomeLine[] {
	const lines: OutcomeLine[] = [];
	for (const action of ACTIONS) {
		const group = map?.[action.key] ?? {};
		const parts = Object.entries(group)
			.filter(([, n]) => n > 0)
			.map(([entity, n]) => entityCount(entity, n));
		if (parts.length) lines.push({ key: action.key, label: action[phase], text: parts.join(', ') });
	}
	return lines;
}

/** «строка 7», «строки 4, 5, 6» (номера — как в Excel); `total` — сколько строк с проблемой всего: остаток «и ещё N». */
export function exampleRows(examples: readonly number[] | null | undefined, total = 0): string {
	const list = (examples ?? []).slice(0, 5);
	if (!list.length) return '';
	const rest = total > list.length ? ` и ещё ${total - list.length}` : '';
	return `${list.length === 1 && total <= 1 ? 'строка' : 'строки'} ${list.join(', ')}${rest}`;
}

/** Названия колонок, встречающиеся в файле больше одного раза (пустые заголовки не считаются). */
export function duplicateHeaders(headers: readonly string[] | null | undefined): string[] {
	const seen = new Set<string>();
	const dups = new Set<string>();
	for (const h of headers ?? []) {
		if (!h) continue;
		if (seen.has(h)) dups.add(h);
		seen.add(h);
	}
	return [...dups];
}

/** Предупреждение о повторяющихся названиях колонок: при разборе значения такой колонки перекрывают друг друга. */
export function duplicateHeadersText(headers: readonly string[] | null | undefined): string | null {
	const list = (headers ?? []).filter(Boolean);
	if (!list.length) return null;
	const names = list.map((h) => `«${h}»`).join(', ');
	return `В файле повторяются названия колонок: ${names}. Значения берутся из последней такой колонки, остальные теряются. Переименуйте колонки в файле и загрузите его заново.`;
}

export interface IssueRemark extends RowRemark {
	severity: 'error' | 'warning';
}

/** Замечания строки: структурные `issues` сервера (сообщение + подсказка), для старых строк — разбор текста `errors`. */
export function rowRemarks(row: RowLike): IssueRemark[] {
	if (row.issues?.length) {
		return row.issues.map((i) => ({
			text: i.message,
			fix: i.hint ?? undefined,
			link: i.code === 'org_not_found' ? { label: 'Организации', href: '/organizations' } : undefined,
			severity: i.severity ?? 'error'
		}));
	}
	return explainRowErrors(row.errors).map((r) => ({ ...r, severity: 'error' as const }));
}

/** Номер строки для человека: строка файла (как в Excel); на листе не первом — с названием листа. */
export function rowLabel(row: { row_number: number; source_row?: number | null; sheet?: string | null }, multiSheet: boolean): string {
	const n = row.source_row ?? row.row_number;
	return multiSheet && row.sheet ? `${row.sheet}, ${n}` : String(n);
}
