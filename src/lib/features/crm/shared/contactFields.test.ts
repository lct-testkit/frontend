import { describe, expect, it } from 'vitest';
import { emailError, phoneError, websiteError } from './contactFields';

describe('emailError', () => {
	it('нормальные адреса, пусто и маска — без ошибки', () => {
		for (const v of ['a@b.ru', ' info@kgtu.ru ', '', '   ', 'i***@a.ru']) expect(emailError(v)).toBeNull();
	});
	it('мусор из QA — ошибка', () => {
		for (const v of ['not-an-email', 'нет', 'a@b', 'a b@c.ru', '@b.ru']) expect(emailError(v)).toBe('Проверьте адрес почты');
	});
});

describe('phoneError', () => {
	it('российские форматы и международный номер с плюсом', () => {
		for (const v of ['+7 (999) 023-43-65', '8 999 023 43 65', '9990234365', '+79990234365', '7-999-023-43-65', '+49 30 1234567', '+7 (999) 023-43-65 доб. 12', '', '+7 (9**) ***-**-67'])
			expect(phoneError(v), v).toBeNull();
	});
	it('«звоните», буквы и слишком короткие — ошибка', () => {
		expect(phoneError('звоните')).toMatch(/цифрами/);
		expect(phoneError('123')).toBe('Слишком короткий номер');
		expect(phoneError('+7 999 023')).toBe('Слишком короткий номер');
		expect(phoneError('12345678901234')).toBe('Проверьте номер телефона');
		expect(phoneError('+7 999 023 43 6')).toBe('Проверьте номер телефона');
		expect(phoneError('+7 999 023 43 65 123')).toBe('Проверьте номер телефона');
	});
});

describe('websiteError', () => {
	it('адреса сайтов и пусто', () => {
		for (const v of ['school.ru', 'www.school.ru/about', 'https://school.ru', 'http://sub.school.ru:8080/x?y=1', '']) expect(websiteError(v), v).toBeNull();
	});
	it('«сайт» и пробелы — ошибка', () => {
		for (const v of ['сайт', 'school', 'my site.ru', 'http://', 'a@b.ru']) expect(websiteError(v), v).toMatch(/Проверьте адрес сайта/);
	});
});
