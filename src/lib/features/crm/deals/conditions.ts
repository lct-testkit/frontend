// Человекочитаемые условия переходов для чек-листа диалога (значения приходят из `available-transitions` и `extra.unmet`).
import { formatDate, formatMoney, formatNumber } from '$lib/utils/format';
import { ATTACHMENT_CATEGORY_LABELS, DEAL_FIELD_LABELS, PRIORITY_LABELS, SIGNATURE_STATUS_LABELS } from '../shared/labels';
import type { CustomFieldDef } from '../types';

export interface ConditionLike {
	field: string;
	op: string;
	expected?: unknown;
	actual?: unknown;
	satisfied?: boolean;
}

const CUSTOM = 'custom_fields.';

/** Подпись поля условия: пользовательские поля — по определениям, остальное — из словаря. */
export function fieldLabel(field: string, defs: CustomFieldDef[] = []): string {
	if (field.startsWith(CUSTOM)) {
		const code = field.slice(CUSTOM.length);
		return defs.find((d) => d.code === code)?.label ?? code.replace(/_/g, ' ');
	}
	if (field.startsWith('attachments.')) {
		const category = field.slice('attachments.'.length);
		return `Файл «${ATTACHMENT_CATEGORY_LABELS[category] ?? category}»`;
	}
	if (field === 'tasks.open_count') return 'Открытые задачи';
	if (field === 'products.count') return 'Продукты сделки';
	if (field === 'signature_status') return 'Статус подписи';
	return DEAL_FIELD_LABELS[field] ?? field;
}

/** Значение для показа: деньги, даты, да/нет, подписи перечислений. */
export function formatValue(field: string, value: unknown): string {
	if (value === null || value === undefined || value === '') return 'не указано';
	if (typeof value === 'boolean') return value ? 'да' : 'нет';
	if (field === 'signature_status') return SIGNATURE_STATUS_LABELS[String(value)] ?? String(value);
	if (field === 'priority') return PRIORITY_LABELS[String(value)] ?? String(value);
	if (field === 'amount') return formatMoney(String(value));
	if (typeof value === 'number') return formatNumber(value);
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
	if (Array.isArray(value)) return value.map((v) => formatValue(field, v)).join(', ');
	return String(value);
}

/** Условие одной фразой: «Сумма заполнена», «Документ подписан», «Открытые задачи: 0». */
export function describeCondition(leaf: ConditionLike, defs: CustomFieldDef[] = []): string {
	const label = fieldLabel(leaf.field, defs);
	const { op, expected } = leaf;
	if (leaf.field === 'signature_status' && op === 'eq') {
		return expected === 'signed' ? 'Документ подписан' : `Статус подписи: ${formatValue(leaf.field, expected)}`;
	}
	switch (op) {
		case 'not_null':
			// невыполненное условие — просьба, а не описание состояния: «Причина отказа: заполнено» у пустого поля читалось как «уже заполнено»
			return leaf.satisfied === false ? `Заполните: ${label.charAt(0).toLowerCase()}${label.slice(1)}` : `${label}: заполнено`;
		case 'is_null':
			return `${label}: не заполнено`;
		case 'exists':
			return leaf.field.startsWith('attachments.') ? `Прикреплён ${label.charAt(0).toLowerCase()}${label.slice(1)}` : `${label}: есть`;
		case 'eq':
			return `${label}: ${formatValue(leaf.field, expected)}`;
		case 'neq':
			return `${label}: не ${formatValue(leaf.field, expected)}`;
		case 'gt':
			return `${label}: больше ${formatValue(leaf.field, expected)}`;
		case 'gte':
			return `${label}: не меньше ${formatValue(leaf.field, expected)}`;
		case 'lt':
			return `${label}: меньше ${formatValue(leaf.field, expected)}`;
		case 'lte':
			return `${label}: не больше ${formatValue(leaf.field, expected)}`;
		case 'in':
			return `${label}: одно из ${formatValue(leaf.field, expected)}`;
		case 'not_in':
			return `${label}: не ${formatValue(leaf.field, expected)}`;
		case 'contains':
			return `${label}: содержит ${formatValue(leaf.field, expected)}`;
		case 'date_before':
			return `${label}: раньше ${formatValue(leaf.field, expected)}`;
		case 'date_after':
			return `${label}: позже ${formatValue(leaf.field, expected)}`;
		default:
			return label;
	}
}

/** «Сейчас: …» для невыполненного условия; пусто, если показывать нечего. */
export function currentText(leaf: ConditionLike): string {
	if (leaf.satisfied) return '';
	if (leaf.op === 'not_null' || leaf.op === 'exists') return '';
	return `сейчас: ${formatValue(leaf.field, leaf.actual)}`;
}
