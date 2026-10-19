import { describe, expect, it } from 'vitest';
import { createFieldValidity } from './field-validity';

describe('createFieldValidity', () => {
	it('форма заблокирована, пока хотя бы одно поле сообщает об ошибке', () => {
		const v = createFieldValidity();
		const a = Symbol('a');
		const b = Symbol('b');
		expect(v.blocked()).toBe(false);
		v.report(a, 'Такой даты нет');
		v.report(b, 'Введите год полностью');
		expect(v.blocked()).toBe(true);
		v.report(a, null);
		expect(v.blocked()).toBe(true);
		v.report(b, null);
		expect(v.blocked()).toBe(false);
	});

	it('повторное сообщение одного поля не копится', () => {
		const v = createFieldValidity();
		const a = Symbol('a');
		v.report(a, 'x');
		v.report(a, 'y');
		v.report(a, null);
		expect(v.blocked()).toBe(false);
	});
});
