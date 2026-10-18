import { describe, expect, it } from 'vitest';
import { mergeConfig, signedCurl, splitConfig, validateRef } from './sourceForm';

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
