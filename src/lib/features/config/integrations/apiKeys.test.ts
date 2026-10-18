import { describe, expect, it } from 'vitest';
import { apiKeyCurl, apiKeyState, validateApiKey } from './apiKeys';

const NOW = Date.parse('2026-10-18T12:00:00Z');

describe('apiKeyState', () => {
	it('действует, истёк, отозван (отзыв важнее срока)', () => {
		expect(apiKeyState({ expires_at: '2026-12-01T00:00:00Z' }, NOW)).toBe('active');
		expect(apiKeyState({ expires_at: '2026-10-01T00:00:00Z' }, NOW)).toBe('expired');
		expect(apiKeyState({ expires_at: '2026-10-18T12:00:00Z' }, NOW)).toBe('expired');
		expect(apiKeyState({ expires_at: '2026-12-01T00:00:00Z', revoked_at: '2026-10-10T00:00:00Z' }, NOW)).toBe('revoked');
		expect(apiKeyState({ expires_at: '2026-10-01T00:00:00Z', revoked_at: '2026-09-01T00:00:00Z' }, NOW)).toBe('revoked');
	});
});

describe('validateApiKey', () => {
	const good = { name: 'Сайт', userId: 'u1', days: 90 };
	it('валидная форма', () => expect(validateApiKey(good)).toEqual({}));
	it('пустое имя, нет учётки, срок вне 1…365', () => {
		expect(validateApiKey({ ...good, name: ' ' }).name).toBeTruthy();
		expect(validateApiKey({ ...good, userId: null }).user).toBeTruthy();
		expect(validateApiKey({ ...good, days: 0 }).days).toBeTruthy();
		expect(validateApiKey({ ...good, days: 366 }).days).toBeTruthy();
		expect(validateApiKey({ ...good, days: null }).days).toBeTruthy();
		expect(validateApiKey({ ...good, days: 1.5 }).days).toBeTruthy();
	});
});

describe('apiKeyCurl', () => {
	it('адрес без двойного слеша, ключ — переменная окружения', () => {
		const text = apiKeyCurl('https://crm.example.local/');
		expect(text).toContain("'https://crm.example.local/api/deals?limit=1'");
		expect(text).toContain('X-API-Key: $CRM_API_KEY');
		expect(text).not.toMatch(/crm_[A-Za-z0-9_-]{16,}/);
	});
});
