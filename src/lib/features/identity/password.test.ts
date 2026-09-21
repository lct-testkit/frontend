import { describe, expect, it } from 'vitest';
import { passwordChecks, passwordServerError, passwordValid } from './password';

describe('passwordChecks', () => {
	it('валидный пароль проходит все проверки', () => {
		const checks = passwordChecks({ current: 'Old-Password-1', next: 'New-Password-12', repeat: 'New-Password-12', email: 'kam.ivanov@rt.ru' });
		expect(passwordValid(checks)).toBe(true);
	});
	it('ловит короткий, совпадающий, с email и с пробелами', () => {
		const byCode = (input: Parameters<typeof passwordChecks>[0]) => Object.fromEntries(passwordChecks(input).map((c) => [c.code, c.ok]));
		expect(byCode({ current: 'x', next: 'short', repeat: 'short' }).length).toBe(false);
		expect(byCode({ current: 'Same-Password-12', next: 'Same-Password-12', repeat: 'Same-Password-12' }).differs).toBe(false);
		expect(byCode({ current: 'x', next: 'kam.ivanov-Secret-1', repeat: 'kam.ivanov-Secret-1', email: 'kam.ivanov@rt.ru' }).no_email).toBe(false);
		expect(byCode({ current: 'x', next: ' Padded-Password-12', repeat: ' Padded-Password-12' }).no_spaces).toBe(false);
		expect(byCode({ current: 'x', next: 'Abcdefghijkl', repeat: 'Abcdefghijkm' }).repeat).toBe(false);
	});
});

describe('passwordServerError', () => {
	it('маппит тексты бэкенда на поля', () => {
		expect(passwordServerError('Текущий пароль неверен').field).toBe('current');
		expect(passwordServerError('Новый пароль и его повтор не совпадают').field).toBe('repeat');
		expect(passwordServerError('Новый пароль должен отличаться от текущего').field).toBe('next');
		expect(passwordServerError(undefined)).toEqual({ field: null, message: 'Не удалось сменить пароль' });
	});
});
