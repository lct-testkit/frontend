import { describe, expect, it } from 'vitest';
import { hashesEqual, isSha256Hex, sha256Hex } from './hash';

describe('sha256Hex', () => {
	it('считает известный вектор', async () => {
		expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
		expect(await sha256Hex(new Uint8Array([0x61, 0x62, 0x63]))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});
	it('пустая строка', async () => {
		expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	});
});

describe('hashesEqual / isSha256Hex', () => {
	it('сравнивает без учёта регистра и пробелов', () => {
		expect(hashesEqual(' ABC ', 'abc')).toBe(true);
		expect(hashesEqual('abc', null)).toBe(false);
	});
	it('валидирует формат', () => {
		expect(isSha256Hex('a'.repeat(64))).toBe(true);
		expect(isSha256Hex('a'.repeat(63))).toBe(false);
	});
});
