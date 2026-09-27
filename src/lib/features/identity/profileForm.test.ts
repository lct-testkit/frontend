import { describe, expect, it } from 'vitest';
import { buildMePatch, profileFormFromMe, validatePhone, type ProfileFormValues } from './profileForm';

describe('profileFormFromMe', () => {
	it('display_name пуст — форма показывает full_name', () => {
		expect(profileFormFromMe({ display_name: null, full_name: 'Иван Тесткитович', timezone: 'Europe/Moscow', phone: null })).toEqual({ displayName: 'Иван Тесткитович', timezone: 'Europe/Moscow', phone: '' });
	});
	it('display_name и phone заданы', () => {
		expect(profileFormFromMe({ display_name: 'Ваня', full_name: 'Иван Тесткитович', timezone: 'Asia/Omsk', phone: '+7 999 123-45-67' })).toEqual({ displayName: 'Ваня', timezone: 'Asia/Omsk', phone: '+7 999 123-45-67' });
	});
});

describe('validatePhone', () => {
	it('пусто — телефон необязателен', () => {
		expect(validatePhone('')).toBeUndefined();
		expect(validatePhone('   ')).toBeUndefined();
	});
	it.each(['+7 999 123-45-67', '89991234567', '+7 (999) 123-45-67', '1234567890'])('валидные: %s', (v) => {
		expect(validatePhone(v)).toBeUndefined();
	});
	it.each(['123', '+7 999 abc 45 67', '12345678901234567', '+7-999-CALL-ME!'])('невалидные: %s', (v) => {
		expect(validatePhone(v)).toBeDefined();
	});
});

describe('buildMePatch', () => {
	const base: ProfileFormValues = { displayName: 'Иван Тесткитович', timezone: 'Europe/Moscow', phone: '' };

	it('без изменений — пустое тело', () => {
		expect(buildMePatch(base, { ...base })).toEqual({});
	});
	it('меняется только имя', () => {
		expect(buildMePatch(base, { ...base, displayName: 'Ваня' })).toEqual({ display_name: 'Ваня' });
	});
	it('пустое имя чистит display_name (null)', () => {
		expect(buildMePatch(base, { ...base, displayName: '' })).toEqual({ display_name: null });
	});
	it('меняется часовой пояс', () => {
		expect(buildMePatch(base, { ...base, timezone: 'Asia/Omsk' })).toEqual({ timezone: 'Asia/Omsk' });
	});
	it('добавляется телефон', () => {
		expect(buildMePatch(base, { ...base, phone: '+7 999 123-45-67' })).toEqual({ phone: '+7 999 123-45-67' });
	});
	it('телефон очищается (null)', () => {
		expect(buildMePatch({ ...base, phone: '+7 999 123-45-67' }, { ...base, phone: '  ' })).toEqual({ phone: null });
	});
	it('несколько полей сразу', () => {
		expect(buildMePatch(base, { displayName: 'Ваня', timezone: 'Asia/Omsk', phone: '+7 999 123-45-67' })).toEqual({ display_name: 'Ваня', timezone: 'Asia/Omsk', phone: '+7 999 123-45-67' });
	});
});
