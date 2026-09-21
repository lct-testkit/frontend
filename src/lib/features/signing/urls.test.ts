import { describe, expect, it } from 'vitest';
import { extractSignToken, isUuid, normalizeSignUrl, previewUrlForFetch, shortHash, spaVerifyUrl } from './urls';

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

describe('previewUrlForFetch', () => {
	const presigned = 'http://localhost:8333/signatures/abc/kp.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef';
	it('меняет origin S3-хоста на текущий, сохраняя путь и подпись', () => {
		expect(previewUrlForFetch(presigned, 'http://localhost:5173', ['http://localhost:8333'])).toBe(
			'http://localhost:5173/signatures/abc/kp.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef'
		);
	});
	it('не трогает чужие и относительные ссылки', () => {
		expect(previewUrlForFetch(presigned, 'http://localhost:5173', [])).toBe(presigned);
		expect(previewUrlForFetch('/public/sign/x/file', 'http://localhost:5173', ['http://localhost:8333'])).toBe('/public/sign/x/file');
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
