// API-ключи для внешних систем (роль «Интеграция», заголовок X-API-Key): состояние ключа, проверка формы, пример вызова.
// Сам ключ сервер показывает один раз при создании; в списке только префикс.

export type ApiKeyState = 'active' | 'expired' | 'revoked';

export interface ApiKeyLike {
	expires_at: string;
	revoked_at?: string | null;
}

export function apiKeyState(key: ApiKeyLike, now: number = Date.now()): ApiKeyState {
	if (key.revoked_at) return 'revoked';
	return new Date(key.expires_at).getTime() <= now ? 'expired' : 'active';
}

export const API_KEY_STATES: Record<ApiKeyState, { label: string; tone: 'success' | 'neutral' | 'error'; hint: string }> = {
	active: { label: 'Действует', tone: 'success', hint: 'Ключ принимается сервером.' },
	expired: { label: 'Истёк', tone: 'neutral', hint: 'Срок действия вышел, ключ больше не принимается. Выпустите новый.' },
	revoked: { label: 'Отозван', tone: 'error', hint: 'Ключ отозван и не принимается. Вернуть его нельзя, выпустите новый.' }
};

export const DEFAULT_EXPIRES_DAYS = 90;
export const MAX_EXPIRES_DAYS = 365;

export interface ApiKeyForm {
	name: string;
	userId: string | null;
	days: number | null;
}

export type ApiKeyErrors = Partial<Record<'name' | 'user' | 'days', string>>;

export function validateApiKey(form: ApiKeyForm): ApiKeyErrors {
	const errors: ApiKeyErrors = {};
	if (!form.name.trim()) errors.name = 'Укажите название';
	if (!form.userId) errors.user = 'Выберите служебную учётку';
	if (form.days === null || !Number.isInteger(form.days) || form.days < 1 || form.days > MAX_EXPIRES_DAYS) errors.days = `От 1 до ${MAX_EXPIRES_DAYS} дней`;
	return errors;
}

/** Пример вызова: адрес из `origin`, ключ — только имя переменной окружения (значение ключа в текст не попадает). */
export function apiKeyCurl(origin: string, variable = 'CRM_API_KEY'): string {
	const base = origin.replace(/\/+$/, '');
	return `curl -s '${base}/api/deals?limit=1' \\\n  -H "X-API-Key: $${variable}"`;
}

/** Права роли «Интеграция» человеческими словами. */
export const INTEGRATION_CAPABILITIES = [
	'создавать сделки и контакты',
	'переводить сделки по статусам',
	'читать организации',
	'принимать данные внешних систем'
];
