import { describe, expect, it } from 'vitest';
import { productCodeError } from './productCode';

describe('productCodeError (C-3)', () => {
	it('нормальные коды проходят', () => {
		for (const code of ['py-base', 'PY_BASE.2', 'ds-pro', '2026', ' py-base ']) expect(productCodeError(code), code).toBeNull();
		expect(productCodeError('a'.repeat(64))).toBeNull();
	});
	it('пробел, кириллица, лишние знаки и длина — ошибка', () => {
		for (const code of ['код с пробелом!', 'курс', 'a b', 'a/b', 'a'.repeat(65)]) expect(productCodeError(code), code).toMatch(/латиница/);
	});
	it('пусто — «Укажите код»', () => {
		expect(productCodeError('  ')).toBe('Укажите код');
	});
});
