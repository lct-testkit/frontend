import { describe, expect, it } from 'vitest';
import { postureChecks, summarize, summaryText, type Posture } from './posture';

const good: Posture = {
	admins_without_totp: [],
	bearer_auth_mode: 'integration_only',
	antivirus: { enabled: true, fail_mode: 'closed', reachable: true },
	audit_hmac_key_set: true,
	field_encryption_enabled: true,
	realm: { brute_force_protected: true, revoke_refresh_token: true, events_enabled: true, ssl_required: 'external' }
};
const find = (p: Posture, key: string) => postureChecks(p).find((c) => c.key === key)!;

describe('postureChecks', () => {
	it('всё включено — все меры в порядке', () => {
		const checks = postureChecks(good);
		expect(checks).toHaveLength(9);
		expect(checks.every((c) => c.status === 'ok')).toBe(true);
		expect(summaryText(summarize(checks))).toBe('Все меры включены.');
	});

	it('администраторы без второго фактора: число в подписи, статус «опасно»', () => {
		const c = find({ ...good, admins_without_totp: [{ user_id: 'u1', email_masked: 'a***@x.ru', role: 'ADMIN' }, { user_id: 'u2', email_masked: 'p***@x.ru', role: 'HEAD' }] }, 'totp');
		expect(c.status).toBe('bad');
		expect(c.label).toBe('Без второго фактора: 2');
	});

	it('Bearer: всем ролям — предупреждение, только служебной или выключен — норма', () => {
		expect(find({ ...good, bearer_auth_mode: 'all' }, 'bearer').status).toBe('warn');
		expect(find({ ...good, bearer_auth_mode: 'off' }, 'bearer').status).toBe('ok');
		expect(find({ ...good, bearer_auth_mode: 'странный' }, 'bearer').status).toBe('unknown');
	});

	it('антивирус: выключен — опасно; недоступен при «пропускать» — опасно, при «отказывать» — предупреждение; режим «пропускать» при работе — предупреждение', () => {
		expect(find({ ...good, antivirus: { enabled: false, fail_mode: 'open', reachable: null } }, 'antivirus').status).toBe('bad');
		expect(find({ ...good, antivirus: { enabled: true, fail_mode: 'open', reachable: false } }, 'antivirus').status).toBe('bad');
		expect(find({ ...good, antivirus: { enabled: true, fail_mode: 'closed', reachable: false } }, 'antivirus').status).toBe('warn');
		expect(find({ ...good, antivirus: { enabled: true, fail_mode: 'open', reachable: true } }, 'antivirus').status).toBe('warn');
	});

	it('ключ аудита и шифрование полей: нет — предупреждение', () => {
		expect(find({ ...good, audit_hmac_key_set: false }, 'audit').status).toBe('warn');
		expect(find({ ...good, field_encryption_enabled: false }, 'encryption').status).toBe('warn');
	});

	it('Keycloak недоступен — одна строка «нет данных», а не пять', () => {
		const checks = postureChecks({ ...good, realm: null });
		const realm = checks.filter((c) => !['totp', 'bearer', 'antivirus', 'audit', 'encryption'].includes(c.key));
		expect(realm).toHaveLength(1);
		expect(realm[0].status).toBe('unknown');
	});

	it('политика realm: каждый признак отдельно, неизвестный — «нет данных», HTTPS «none» — опасно', () => {
		const p = { ...good, realm: { brute_force_protected: false, revoke_refresh_token: null, events_enabled: true, ssl_required: 'none' } };
		expect(find(p, 'brute').status).toBe('bad');
		expect(find(p, 'refresh').status).toBe('unknown');
		expect(find(p, 'events').status).toBe('ok');
		expect(find(p, 'ssl').status).toBe('bad');
	});
});

describe('summarize / summaryText', () => {
	it('считает по статусам и пишет, сколько требует внимания', () => {
		const s = summarize(postureChecks({ ...good, audit_hmac_key_set: false, antivirus: { enabled: false, fail_mode: 'open', reachable: null }, realm: null }));
		expect(s).toEqual({ bad: 1, warn: 1, unknown: 1, ok: 3 });
		expect(summaryText(s)).toBe('не включено или опасно: 1 · стоит усилить: 1 · нет данных: 1');
	});
	it('ничего плохого, но есть непроверенное', () => {
		expect(summaryText({ bad: 0, warn: 0, unknown: 2, ok: 7 })).toBe('Всё, что удалось проверить, в порядке. Нет данных по 2.');
	});
});
