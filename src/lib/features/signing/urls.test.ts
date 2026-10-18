import { describe, expect, it } from 'vitest';
import { extractSignToken, isUuid, normalizeSignUrl, shortHash, spaVerifyUrl } from './urls';

const TOKEN = 'Qm9y4l7n6WJ4YCf3s0vJ2eGz8XxK1pqRtUvWyZ01AbC';

describe('extractSignToken / normalizeSignUrl', () => {
	it('достаёт токен из бэкендовской ссылки на JSON-ручку', () => {
		expect(extractSignToken(`http://localhost:8080/public/sign/${TOKEN}`)).toBe(TOKEN);
		expect(extractSignToken(`https://crm.local/sign/${TOKEN}?utm=1`)).toBe(TOKEN);
		expect(extractSignToken(TOKEN)).toBe(TOKEN);
		expect(extractSignToken('short')).toBeNull();
	});
	it('переписывает на страницу SPA', () => {
		expect(normalizeSignUrl(`http://localhost:8080/public/sign/${TOKEN}`, 'http://localhost:5173/')).toBe(`http://localhost:5173/sign/${TOKEN}`);
		expect(normalizeSignUrl('https://example.org/other', 'http://localhost:5173')).toBe('https://example.org/other');
	});
});

describe('прочее', () => {
	it('isUuid', () => {
		expect(isUuid('0192a1b2-3c4d-7e8f-9a0b-1c2d3e4f5a6b')).toBe(true);
		expect(isUuid('not-a-uuid')).toBe(false);
	});
	it('spaVerifyUrl', () => {
		expect(spaVerifyUrl('http://h/', 'id')).toBe('http://h/verify/id');
	});
	it('shortHash', () => {
		expect(shortHash('a'.repeat(64))).toBe('aaaaaaaa…aaaa');
		expect(shortHash('short')).toBe('short');
	});
});
