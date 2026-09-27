// Свой профиль (`PATCH /api/me`): значения формы ↔ тело запроса, минимальная проверка телефона на клиенте —
// зеркало `identity.schemas._check_phone` (окончательно проверяет сервер, ошибку 422 показываем как есть).
import type { components } from '$lib/api';

export interface ProfileFormValues {
	displayName: string;
	timezone: string;
	phone: string;
}

export function profileFormFromMe(me: Pick<components['schemas']['MeResponse'], 'display_name' | 'full_name' | 'timezone' | 'phone'>): ProfileFormValues {
	return { displayName: me.display_name ?? me.full_name, timezone: me.timezone, phone: me.phone ?? '' };
}

/** «От 10 до 15 цифр, разрешены «+», пробелы, дефисы и скобки» — как на бэкенде; пустое значение — телефон не задан, это допустимо. */
export function validatePhone(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const digits = trimmed.replace(/\D/g, '');
	if (!/^\+?[\d\s()-]+$/.test(trimmed) || digits.length < 10 || digits.length > 15) return 'Телефон: от 10 до 15 цифр, допустимы «+», пробелы, дефисы и скобки';
	return undefined;
}

/** Только изменённые поля; пустая строка чистит `display_name`/`phone` (сервер сам обнуляет пустое имя, здесь — то же самое для явности). */
export function buildMePatch(base: ProfileFormValues, values: ProfileFormValues): components['schemas']['MePatchRequest'] {
	const body: components['schemas']['MePatchRequest'] = {};
	const displayName = values.displayName.trim();
	if (displayName !== base.displayName.trim()) body.display_name = displayName || null;
	if (values.timezone !== base.timezone) body.timezone = values.timezone;
	const phone = values.phone.trim();
	if (phone !== base.phone.trim()) body.phone = phone || null;
	return body;
}
