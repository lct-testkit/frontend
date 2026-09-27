import { describe, expect, it } from 'vitest';
import { LEARNER_SECTIONS, displayValue, fieldRows, filledFields } from './learnerProfile';

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
