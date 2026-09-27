import { describe, expect, it } from 'vitest';
import { isStatusField, statusGroup } from './dealSections';

describe('statusGroup', () => {
	it('заморозка и отказ — свои группы, остальное без группы', () => {
		expect(statusGroup('parked')).toBe('frozen');
		expect(statusGroup('lost')).toBe('lost');
		expect(statusGroup('won')).toBeNull();
		expect(statusGroup('intermediate')).toBeNull();
		expect(statusGroup(undefined)).toBeNull();
	});
});

describe('isStatusField', () => {
	it('поля заморозки — только в замороженной сделке', () => {
		expect(isStatusField('resume_at', 'frozen')).toBe(true);
		expect(isStatusField('park_reason', 'frozen')).toBe(true);
		expect(isStatusField('resume_at', null)).toBe(false);
		expect(isStatusField('resume_at', 'lost')).toBe(false);
	});
	it('обязательное поле статуса тоже идёт в группу', () => {
		expect(isStatusField('why', 'lost', ['custom_fields.why'])).toBe(true);
		expect(isStatusField('other', 'lost', ['custom_fields.why'])).toBe(false);
	});
});
