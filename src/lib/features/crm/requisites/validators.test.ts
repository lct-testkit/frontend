import { describe, expect, it } from 'vitest';
import {
	looksLikeInn,
	normalizeRequisite,
	validateInn,
	validateKpp,
	validateOgrn,
	validateOgrnAny,
	validateOgrnip,
	validateRequisite
} from './validators';

// Реальные ИНН/ОГРН из общедоступных регистрационных данных — те же фикстуры, что в backend/tests/test_catalog.py:
// придуманный номер легко случайно окажется валидным и не поймает регрессию весов.
describe('validateInn', () => {
	it('принимает 10-значные ИНН юрлиц', () => {
		expect(validateInn('7707083893').ok).toBe(true); // Сбербанк
		expect(validateInn('7736207543').ok).toBe(true); // Яндекс
		expect(validateInn('7707049388').ok).toBe(true); // Ростелеком
	});

	it('принимает 12-значный ИНН', () => {
		expect(validateInn('500100732259').ok).toBe(true);
	});

	it('терпит пробелы и дефисы из буфера обмена', () => {
		expect(validateInn(' 7707 049388 ').ok).toBe(true);
		expect(normalizeRequisite('7707-049-388')).toBe('7707049388');
	});

	it('отклоняет неверную контрольную сумму', () => {
		const result = validateInn('7707049380');
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('Неверная контрольная сумма ИНН');
	});

	it('отклоняет нецифровые, короткие, одинаковые и с плохим регионом', () => {
		expect(validateInn('770704938X').reason).toBe('ИНН должен состоять только из цифр');
		expect(validateInn('77070493').reason).toBe('ИНН должен содержать 10 или 12 цифр');
		expect(validateInn('1111111111').reason).toBe('ИНН не может состоять из одинаковых цифр');
		expect(validateInn('0007049388').reason).toBe('Некорректный код региона в ИНН');
		expect(validateInn(null).ok).toBe(false);
		expect(validateInn('').ok).toBe(false);
	});
});

describe('validateKpp / validateOgrn / validateOgrnip', () => {
	it('КПП — ровно 9 цифр', () => {
		expect(validateKpp('770701001').ok).toBe(true);
		expect(validateKpp('7707010').ok).toBe(false);
		expect(validateKpp('77070100A').ok).toBe(false);
	});

	it('ОГРН Сбербанка валиден, испорченная контрольная цифра — нет', () => {
		expect(validateOgrn('1027700132195').ok).toBe(true);
		expect(validateOgrn('1027700132196').reason).toBe('Неверная контрольная сумма ОГРН');
		expect(validateOgrn('12345').reason).toBe('ОГРН должен состоять из 13 цифр');
	});

	it('ОГРНИП: контрольная цифра = (первые 14 mod 13) mod 10', () => {
		const prefix = '30450011600015';
		const check = (Number(prefix) % 13) % 10;
		expect(validateOgrnip(prefix + String(check)).ok).toBe(true);
		expect(validateOgrnip(prefix + String((check + 1) % 10)).ok).toBe(false);
		expect(validateOgrnip('12345').reason).toBe('ОГРНИП должен состоять из 15 цифр');
	});

	it('validateOgrnAny выбирает алгоритм по длине', () => {
		expect(validateOgrnAny('1027700132195').ok).toBe(true);
		const prefix = '30450011600015';
		expect(validateOgrnAny(prefix + String((Number(prefix) % 13) % 10)).ok).toBe(true);
	});
});

describe('validateRequisite / looksLikeInn', () => {
	it('диспетчеризует по типу и отклоняет неизвестный', () => {
		expect(validateRequisite('inn', '7707049388').ok).toBe(true);
		expect(validateRequisite('inn', 'bad').ok).toBe(false);
		expect(validateRequisite('passport', '1234').reason).toContain('Неизвестный тип реквизита');
	});

	it('looksLikeInn — только форма, без контрольной суммы', () => {
		expect(looksLikeInn('7707049380')).toBe(true);
		expect(looksLikeInn('770704938')).toBe(false);
		expect(looksLikeInn('МГУ')).toBe(false);
	});
});
