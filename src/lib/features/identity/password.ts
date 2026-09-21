// Клиентское зеркало политики пароля (new_spec §4.4 + PasswordChangeRequest): подсказки до отправки.
// Сервер остаётся истиной (историю паролей и словарь проверяет Keycloak).

export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordCheck {
	code: 'length' | 'differs' | 'repeat' | 'no_email' | 'no_spaces';
	label: string;
	ok: boolean;
}

export interface PasswordFormInput {
	current: string;
	next: string;
	repeat: string;
	email?: string | null;
}

export function passwordChecks(input: PasswordFormInput): PasswordCheck[] {
	const next = input.next;
	const local = (input.email ?? '').split('@')[0]?.toLowerCase() ?? '';
	const containsEmail = local.length >= 3 && next.toLowerCase().includes(local);
	return [
		{ code: 'length', label: `Не короче ${PASSWORD_MIN_LENGTH} символов`, ok: next.length >= PASSWORD_MIN_LENGTH },
		{ code: 'differs', label: 'Отличается от текущего', ok: next.length > 0 && next !== input.current },
		{ code: 'repeat', label: 'Повтор совпадает', ok: next.length > 0 && next === input.repeat },
		{ code: 'no_email', label: 'Не содержит имя учётной записи', ok: !containsEmail },
		{ code: 'no_spaces', label: 'Без пробелов по краям', ok: next === next.trim() }
	];
}

export const passwordValid = (checks: readonly PasswordCheck[]): boolean => checks.every((c) => c.ok);

/** Ошибки под полями по ответу 422 бэкенда (`errors[]` или `detail`). */
export function passwordServerError(detail: string | null | undefined): { field: 'current' | 'next' | 'repeat' | null; message: string } {
	const text = (detail ?? '').toLowerCase();
	if (text.includes('текущий пароль неверен')) return { field: 'current', message: 'Текущий пароль неверен' };
	if (text.includes('не совпадают')) return { field: 'repeat', message: 'Новый пароль и его повтор не совпадают' };
	if (text.includes('отличаться')) return { field: 'next', message: 'Новый пароль должен отличаться от текущего' };
	if (text.includes('keycloak')) return { field: null, message: 'Смена пароля доступна только пользователям с учётной записью Keycloak' };
	return { field: null, message: detail || 'Не удалось сменить пароль' };
}
