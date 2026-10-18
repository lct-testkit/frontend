// Клиентское зеркало политики пароля (new_spec §4.4 + PasswordChangeRequest): подсказки до отправки.
// Сервер остаётся истиной (историю паролей и словарь проверяет Keycloak).

const PASSWORD_MIN_LENGTH = 12;

export interface PasswordCheck {
	code: 'length' | 'upper' | 'lower' | 'digit' | 'differs' | 'repeat' | 'no_email' | 'no_spaces';
	label: string;
	ok: boolean;
}

export interface PasswordFormInput {
	current: string;
	next: string;
	repeat: string;
	email?: string | null;
	/** форма приглашения: текущего пароля ещё нет — пункта «отличается от текущего» нет */
	skipCurrent?: boolean;
	/** форма приглашения: почта известна только в маске — совпадение с ней проверит сервер */
	skipEmail?: boolean;
	/** политика realm: заглавная, строчная, цифра — подсказки до отправки */
	complexity?: boolean;
}

export function passwordChecks(input: PasswordFormInput): PasswordCheck[] {
	const next = input.next;
	const local = (input.email ?? '').split('@')[0]?.toLowerCase() ?? '';
	const containsEmail = local.length >= 3 && next.toLowerCase().includes(local);
	const checks: PasswordCheck[] = [{ code: 'length', label: `Не короче ${PASSWORD_MIN_LENGTH} символов`, ok: next.length >= PASSWORD_MIN_LENGTH }];
	if (input.complexity) {
		checks.push(
			{ code: 'upper', label: 'Заглавная буква', ok: /\p{Lu}/u.test(next) },
			{ code: 'lower', label: 'Строчная буква', ok: /\p{Ll}/u.test(next) },
			{ code: 'digit', label: 'Цифра', ok: /\d/.test(next) }
		);
	}
	if (!input.skipCurrent) checks.push({ code: 'differs', label: 'Отличается от текущего', ok: next.length > 0 && next !== input.current });
	checks.push({ code: 'repeat', label: 'Повтор совпадает', ok: next.length > 0 && next === input.repeat });
	if (!input.skipEmail) checks.push({ code: 'no_email', label: 'Не содержит имя учётной записи', ok: !containsEmail });
	checks.push({ code: 'no_spaces', label: 'Без пробелов по краям', ok: next.length > 0 && next === next.trim() });
	return checks;
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

/** Тексты политики Keycloak приходят по-английски («Invalid password: must contain at least 1 upper case characters.») — человеческая причина под полем. */
export function invitePasswordServerError(detail: string | null | undefined, reason?: string | null): { field: 'next' | 'repeat' | null; message: string } {
	const text = `${detail ?? ''} ${reason ?? ''}`.toLowerCase();
	if (text.includes('не совпадают')) return { field: 'repeat', message: 'Пароль и его повтор не совпадают' };
	if (text.includes('upper case')) return { field: 'next', message: 'Нужна хотя бы одна заглавная буква' };
	if (text.includes('lower case')) return { field: 'next', message: 'Нужна хотя бы одна строчная буква' };
	if (text.includes('digit')) return { field: 'next', message: 'Нужна хотя бы одна цифра' };
	if (text.includes('special')) return { field: 'next', message: 'Нужен хотя бы один специальный символ' };
	if (text.includes('at least 12') || text.includes('length')) return { field: 'next', message: `Не короче ${PASSWORD_MIN_LENGTH} символов` };
	if (text.includes('username') || text.includes('email')) return { field: 'next', message: 'Пароль не должен совпадать с именем учётной записи или почтой' };
	if (text.includes('history') || text.includes('recently') || text.includes('used')) return { field: 'next', message: 'Этот пароль уже использовался, придумайте другой' };
	if (text.includes('не соответствует политике') || text.includes('invalid password')) return { field: 'next', message: 'Пароль не соответствует политике безопасности' };
	return { field: null, message: 'Не удалось задать пароль. Проверьте поля и повторите.' };
}
