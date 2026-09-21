// Ошибка сохранения формы → куда её показать: под конкретным полем, общей плашкой или плашкой конфликта версий (409 CRM-1002).
import { ApiError, errorMessage } from '$lib/api';

export interface FormFailure {
	fields: Record<string, string>;
	/** текст общей ошибки, если она не относится ни к одному полю */
	form: string | null;
	conflict: boolean;
}

const DUPLICATE_CODES = new Set(['CRM-1301', 'CRM-1302']);

/**
 * `known` — имена полей формы (как в теле запроса). Ошибки валидации сервера (`errors[{field,reason}]`) попадают под поля,
 * дубли по коду/уникальному ключу (409) — под первое из `known` (обычно `code`).
 */
export function toFormFailure(e: unknown, known: readonly string[]): FormFailure {
	if (!(e instanceof ApiError)) return { fields: {}, form: errorMessage(e), conflict: false };
	if (e.isConflict) return { fields: {}, form: null, conflict: true };
	const fields: Record<string, string> = {};
	const rest: string[] = [];
	for (const issue of e.errors) {
		const name = known.find((k) => issue.field === k || issue.field.endsWith(`.${k}`));
		if (name && !(name in fields)) fields[name] = issue.reason;
		else rest.push(issue.reason);
	}
	if (Object.keys(fields).length && !rest.length) return { fields, form: null, conflict: false };
	if (e.status === 409 && known.length && (e.code === null || DUPLICATE_CODES.has(e.code) || /уже|существ|дубл/i.test(e.detail))) {
		return { fields: { [known[0]]: e.detail }, form: null, conflict: false };
	}
	return { fields, form: rest[0] ?? errorMessage(e), conflict: false };
}
