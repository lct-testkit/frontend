import { describe, expect, it } from 'vitest';
import { mergeConfig, signedCurl, sourceAccessErrors, splitConfig, validateRef } from './sourceForm';

describe('validateRef', () => {
	it('принимает CMS_WEBHOOK_SECRET и пустое значение; отклоняет «1ABC» и строку с пробелом', () => {
		expect(validateRef('CMS_WEBHOOK_SECRET')).toBeNull();
		expect(validateRef('')).toBeNull();
		expect(validateRef('1ABC')).toMatch(/латиница/);
		expect(validateRef('MY SECRET')).toMatch(/без пробелов/);
	});
	it('не длиннее 128 знаков', () => {
		expect(validateRef('A'.repeat(128))).toBeNull();
		expect(validateRef('A'.repeat(129))).toMatch(/128/);
	});
});

describe('splitConfig / mergeConfig', () => {
	it('два ключа становятся полями, остальные сохраняются при сборке обратно', () => {
		const cfg = { signing_secret_ref: 'MY_SECRET', require_timestamp: true, note: 'x', nested: { a: 1 } };
		const parts = splitConfig(cfg);
		expect(parts).toMatchObject({ signingSecretRef: 'MY_SECRET', requireTimestamp: true, rest: { note: 'x', nested: { a: 1 } } });
		expect(mergeConfig(parts)).toEqual(cfg);
	});
	it('выключенная метка и пустое имя не попадают в config', () => {
		expect(mergeConfig({ signingSecretRef: ' ', requireTimestamp: false, rest: { k: 1 } })).toEqual({ k: 1 });
		expect(splitConfig(null)).toEqual({ signingSecretRef: '', requireTimestamp: false, rest: {} });
	});
	it('require_timestamp не true — выключено', () => {
		expect(splitConfig({ require_timestamp: 'yes' }).requireTimestamp).toBe(false);
	});
});

describe('signedCurl', () => {
	const base = { origin: 'https://crm.example.local', path: '/api/v1/integrations/cms/leads', body: '{"lead_id":"1"}', secretVar: 'CMS_WEBHOOK_SECRET', idempotencyKey: 'demo-1' };
	it('без метки: подпись по телу', () => {
		const c = signedCurl({ ...base, timestamp: false });
		expect(c).toContain(`printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$CMS_WEBHOOK_SECRET"`);
		expect(c).not.toContain('X-Timestamp');
		expect(c).toContain("Idempotency-Key: demo-1");
	});
	it('с меткой: подписывается «метка.тело» и уходит X-Timestamp', () => {
		const c = signedCurl({ ...base, timestamp: true });
		expect(c).toContain('TS=$(date +%s)');
		expect(c).toContain(`printf '%s' "$TS.$BODY"`);
		expect(c).toContain('X-Timestamp: $TS');
	});
});

describe('адрес и способ входа источника (G-3)', () => {
	it('валидный адрес и пустой у выключенного — без ошибок', () => {
		expect(sourceAccessErrors({ baseUrl: 'https://crm.example.ru/api', authType: null, enabled: false })).toEqual({});
		expect(sourceAccessErrors({ baseUrl: '  ', authType: null, enabled: false })).toEqual({});
		expect(sourceAccessErrors({ baseUrl: '', authType: null, enabled: false })).toEqual({});
	});
	it('«сайт», ftp и адрес без хоста — ошибка', () => {
		for (const bad of ['сайт', 'example.ru', 'ftp://example.ru', 'https://', 'javascript:alert(1)']) expect(sourceAccessErrors({ baseUrl: bad, authType: null, enabled: false }).base_url, bad).toBeDefined();
	});
	it('у включённого источника адрес и способ входа обязательны', () => {
		expect(Object.keys(sourceAccessErrors({ baseUrl: '', authType: null, enabled: true })).sort()).toEqual(['auth_type', 'base_url']);
		expect(sourceAccessErrors({ baseUrl: 'https://a.ru', authType: 'hmac', enabled: true })).toEqual({});
		expect(sourceAccessErrors({ baseUrl: 'сайт', authType: null, enabled: false }).base_url).toBeDefined();
	});
});
