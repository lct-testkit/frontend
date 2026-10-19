import { describe, expect, it } from 'vitest';
import { DATE_KEYS, LEARNER_SECTIONS, digitFieldWidth, displayValue, fieldRows, filledFields, isDigitField, maskDigits, validateProfileValues } from './learnerProfile';

describe('профиль учащегося', () => {
	it('пол показывается словами', () => {
		expect(displayValue('sex', 'M')).toBe('Мужской');
		expect(displayValue('sex', 'F')).toBe('Женский');
	});

	it('дата — ДД.ММ.ГГГГ, год без изменений', () => {
		expect(displayValue('birth_date', '1990-05-17')).toBe('17.05.1990');
		expect(displayValue('birth_date', '1990')).toBe('1990');
	});

	it('маска остаётся маской', () => {
		expect(displayValue('snils', '***595')).toBe('***595');
	});

	it('пустые поля не показываются', () => {
		const passport = LEARNER_SECTIONS.find((s) => s.key === 'passport')!;
		const shown = filledFields({ passport_series: '***', passport_number: null, passport_issued_by: '' }, passport.fields);
		expect(shown).toEqual([{ key: 'passport_series', label: 'Серия', value: '***' }]);
	});

	it('каждое поле профиля встречается ровно в одной секции', () => {
		const keys = LEARNER_SECTIONS.flatMap((s) => s.fields.map((x) => x.key));
		expect(new Set(keys).size).toBe(keys.length);
		// 25 полей профиля из шаблона LMS; вместо кода образования показывается его подпись
		expect(keys).toHaveLength(25);
	});
});

describe('ряды формы', () => {
	it('широкое поле — свой ряд, узкие встают по два', () => {
		const rows = fieldRows([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C', wide: true }, { key: 'd', label: 'D' }, { key: 'e', label: 'E' }, { key: 'f', label: 'F' }]);
		expect(rows.map((r) => r.map((x) => x.key).join(''))).toEqual(['ab', 'c', 'de', 'f']);
	});

	it('СНИЛС стоит в секции паспорта, образование — вместе с дипломом', () => {
		const section = (key: string) => LEARNER_SECTIONS.find((s) => s.key === key)!.fields.map((x) => x.key);
		expect(section('passport')).toContain('snils');
		expect(section('diploma')).toContain('education_label');
		expect(section('person')).not.toContain('education_label');
	});
});

describe('правка профиля', () => {
	it('в тело попадает только введённое, образование — под кодом education', async () => {
		const { buildProfilePatch } = await import('./learnerProfile');
		expect(buildProfilePatch({ snils: ' 112-233-445 95 ', passport_series: '', education_label: 'higher_bachelor' })).toEqual({
			snils: '112-233-445 95',
			education: 'higher_bachelor'
		});
	});

	it('пустая форма — пустое тело', async () => {
		const { buildProfilePatch } = await import('./learnerProfile');
		expect(buildProfilePatch({ snils: '  ' })).toEqual({});
	});
});

describe('ввод цифровых полей анкеты (LP-1)', () => {
	it('СНИЛС и код подразделения расставляют разделители сами', () => {
		expect(maskDigits('snils', '12345678901')).toBe('123-456-789 01');
		expect(maskDigits('snils', '1234')).toBe('123-4');
		expect(maskDigits('snils', '123')).toBe('123');
		expect(maskDigits('snils', '123-456-789 01 99')).toBe('123-456-789 01');
		expect(maskDigits('passport_dept_code', '123456')).toBe('123-456');
		expect(maskDigits('passport_dept_code', '12a3')).toBe('123');
	});
	it('серия, номер, индекс — только цифры нужной длины', () => {
		expect(maskDigits('passport_series', '45 12')).toBe('4512');
		expect(maskDigits('passport_series', '451267')).toBe('4512');
		expect(maskDigits('passport_number', 'ab123456789')).toBe('123456');
		expect(maskDigits('reg_zip', '420-111')).toBe('420111');
		expect(maskDigits('reg_city', 'Казань 1')).toBe('Казань 1');
	});
	it('ширина поля с разделителями', () => {
		expect(digitFieldWidth('snils')).toBe(14);
		expect(digitFieldWidth('passport_dept_code')).toBe(7);
		expect(digitFieldWidth('passport_series')).toBe(4);
		expect(digitFieldWidth('reg_city')).toBeUndefined();
	});
	it('ошибка длины под полем; пустое поле — не ошибка', () => {
		expect(validateProfileValues({ passport_series: '45' }).passport_series).toBe('Серия паспорта: 4 цифры');
		expect(validateProfileValues({ passport_number: '12345' }).passport_number).toBe('Номер паспорта: 6 цифр');
		expect(validateProfileValues({ snils: '123-456-789' }).snils).toBe('СНИЛС: 11 цифр');
		expect(validateProfileValues({ snils: '' }).snils).toBeUndefined();
		expect(validateProfileValues({ snils: '123-456-789 01' }).snils).toBeUndefined();
		expect(validateProfileValues({ passport_series: '45', reg_zip: '420111', reg_city: 'Казань' })).toEqual({ passport_series: 'Серия паспорта: 4 цифры' });
	});
	it('даты — календарь, цифровые — не даты', () => {
		expect([...DATE_KEYS].sort()).toEqual(['birth_date', 'diploma_issued_at', 'passport_issued_at']);
		expect(isDigitField('snils')).toBe(true);
		expect(isDigitField('birth_date')).toBe(false);
		const keys = LEARNER_SECTIONS.flatMap((x) => x.fields.map((fld) => fld.key));
		for (const key of DATE_KEYS) expect(keys).toContain(key);
	});
});
