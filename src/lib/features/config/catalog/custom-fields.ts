// Пользовательские поля: как храним варианты выбора и правила проверки в свободных JSON-полях `options` / `validation`
// (бэкенд их не интерпретирует): `options: { choices: ['Да', 'Нет'] }`, `validation: { min, max }` | `{ max_length, pattern }`.
import type { CustomFieldDef } from '../types';

export interface FieldValidation {
	min?: number;
	max?: number;
	max_length?: number;
	pattern?: string;
}

export function choicesOf(def: Pick<CustomFieldDef, 'options'>): string[] {
	const raw = def.options && typeof def.options === 'object' ? (def.options as Record<string, unknown>).choices : null;
	return Array.isArray(raw) ? raw.map(String) : [];
}

export function validationOf(def: Pick<CustomFieldDef, 'validation'>): FieldValidation {
	return def.validation && typeof def.validation === 'object' ? (def.validation as FieldValidation) : {};
}

/** Тело `options` / `validation` для API из значений формы; пустое → null. */
export function buildOptions(type: string, choices: readonly string[]): Record<string, unknown> | null {
	return (type === 'select' || type === 'multiselect') && choices.length ? { choices: [...choices] } : null;
}

export function buildValidation(type: string, rules: FieldValidation): Record<string, unknown> | null {
	const out: Record<string, unknown> = {};
	if (type === 'number') {
		if (rules.min !== undefined) out.min = rules.min;
		if (rules.max !== undefined) out.max = rules.max;
	} else if (type === 'string') {
		if (rules.max_length !== undefined) out.max_length = rules.max_length;
		if (rules.pattern) out.pattern = rules.pattern;
	}
	return Object.keys(out).length ? out : null;
}

/** Ошибка формы значений пользовательских полей: обязательные и границы. */
export function checkCustomValues(defs: readonly CustomFieldDef[], values: Record<string, unknown>): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const def of defs) {
		if (def.field_type === 'file' || !def.is_active) continue;
		const v = values[def.code];
		const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
		if (def.is_required && empty && def.field_type !== 'bool') {
			errors[def.code] = 'Обязательное поле';
			continue;
		}
		const rules = validationOf(def);
		if (def.field_type === 'number' && typeof v === 'number') {
			if (rules.min !== undefined && v < rules.min) errors[def.code] = `Не меньше ${rules.min}`;
			else if (rules.max !== undefined && v > rules.max) errors[def.code] = `Не больше ${rules.max}`;
		}
		if (def.field_type === 'string' && typeof v === 'string' && v) {
			if (rules.max_length !== undefined && v.length > rules.max_length) errors[def.code] = `Не длиннее ${rules.max_length} символов`;
			else if (rules.pattern) {
				try {
					if (!new RegExp(rules.pattern).test(v)) errors[def.code] = 'Значение не подходит по формату';
				} catch {
					// некорректное выражение в определении — не блокируем ввод
				}
			}
		}
	}
	return errors;
}

/** Пустые значения не отправляем: сервер сливает `custom_fields` и удалить ключ можно только записью null. */
export function cleanValues(values: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
}
