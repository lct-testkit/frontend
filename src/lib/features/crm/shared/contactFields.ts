// Проверка телефона, почты и сайта до отправки: один набор правил для контактов и организаций (зеркало `core.normalize` бэкенда —
// окончательно проверяет сервер). Маскированное значение («i***@a.ru», пришло скрытым и не тронуто) не проверяется. Пустое поле — допустимо.
const MASKED = (v: string) => v.includes('*');

/** `null` — всё в порядке. */
export function emailError(value: string): string | null {
	const v = value.trim();
	if (!v || MASKED(v)) return null;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Проверьте адрес почты';
}

/**
 * Российские форматы: `8 999 …`, `7 (999) …`, `+7-999-…`, 10 цифр без кода страны; с `+` и другой страной — 8–15 цифр.
 * Добавочный («доб. 123») не считается.
 */
export function phoneError(value: string): string | null {
	const v = value.trim();
	if (!v || MASKED(v)) return null;
	const body = v.replace(/\s*(?:доб\.?|ext\.?|вн\.?|#)\s*\d+\s*$/i, '');
	if (!/^\+?[\d\s()\-.]+$/.test(body)) return 'Введите номер телефона цифрами';
	const digits = body.replace(/\D/g, '');
	if (digits.length < 8) return 'Слишком короткий номер';
	if (body.startsWith('+')) {
		const ok = digits.startsWith('7') ? digits.length === 11 : digits.length >= 8 && digits.length <= 15;
		return ok ? null : 'Проверьте номер телефона';
	}
	return digits.length === 10 || (digits.length === 11 && '78'.includes(digits[0])) ? null : 'Проверьте номер телефона';
}

/** `school.ru`, `www.school.ru/about`, `https://school.ru`: имя сайта с точкой, без пробелов. */
export function websiteError(value: string): string | null {
	const v = value.trim();
	if (!v) return null;
	const host = v.replace(/^https?:\/\//i, '');
	return /^[^\s/.:@]+(\.[^\s/.:@]+)+(:\d+)?([/?#]\S*)?$/.test(host) ? null : 'Проверьте адрес сайта, например school.ru';
}
