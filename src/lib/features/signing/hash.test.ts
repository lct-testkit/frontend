import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('sha256Hex без crypto.subtle (небезопасный контекст: http на не-localhost)', () => {
	// Регрессия: без чистого JS-фолбэка здесь падал TypeError, и ConsentGate (обязательный экран
	// согласия, отказ = выход) был непроходим на install.sh --tls off с публичным --host.
	const original = globalThis.crypto.subtle;
	afterEach(() => {
		vi.stubGlobal('crypto', { ...globalThis.crypto, subtle: original });
	});

	it('даёт тот же результат, что и WebCrypto', async () => {
		vi.stubGlobal('crypto', { ...globalThis.crypto, subtle: undefined });
		expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
		expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
		expect(await sha256Hex('а б в 日本語 emoji 🎉')).toBe(await (async () => {
			vi.stubGlobal('crypto', { ...globalThis.crypto, subtle: original });
			return sha256Hex('а б в 日本語 emoji 🎉');
		})());
	});

	it('обрабатывает вход длиннее одного 64-байтового блока (несколько итераций паддинга)', async () => {
		vi.stubGlobal('crypto', { ...globalThis.crypto, subtle: undefined });
		const long = 'x'.repeat(1000);
		const fallback = await sha256Hex(long);
		vi.stubGlobal('crypto', { ...globalThis.crypto, subtle: original });
		expect(fallback).toBe(await sha256Hex(long));
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
