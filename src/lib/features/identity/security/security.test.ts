import { describe, expect, it } from 'vitest';
import { detailRows } from './details';
import { eventLink } from './links';
import { countOf } from './summary';
import { SECURITY_EVENT_HINTS, SECURITY_EVENT_LABELS, securityEventLabel, severityMeta } from './security-labels';
import { apiQuery, describeFilters, emptySecurityFilters, readFilters, splitTypes } from './security-query';

// Типы из `SecurityEventType` бэкенда (identity/models.py): новый тип без подписи роняет тест.
const BACKEND_TYPES = ['LOGIN_FAILED', 'BRUTE_FORCE_LOCK', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'SESSION_HIJACK_SUSPECT', 'PERMISSION_DENIED', 'MALWARE_DETECTED', 'FILE_REJECTED', 'MASS_EXPORT', 'SIGNATURE_OTP_FAILED', 'SIGNATURE_TOKEN_PROBE', 'SIGNATURE_KEY_COMPROMISED', 'INTEGRATION_SIGNATURE_INVALID'];

describe('подписи', () => {
	it('у каждого типа бэкенда есть подпись и подсказка', () => {
		for (const t of BACKEND_TYPES) {
			expect(SECURITY_EVENT_LABELS[t], t).toBeTruthy();
			expect(SECURITY_EVENT_HINTS[t], t).toBeTruthy();
		}
	});
	it('незнакомый тип — как есть; серьёзность — подпись и тон', () => {
		expect(securityEventLabel('NEW_THING')).toBe('NEW_THING');
		expect(severityMeta('critical')).toEqual({ label: 'Критично', tone: 'error' });
		expect(severityMeta('info')).toEqual({ label: 'Информация', tone: 'neutral' });
		expect(severityMeta('weird')).toEqual({ label: 'weird', tone: 'neutral' });
	});
});

describe('фильтры', () => {
	const get = (m: Record<string, string>) => (k: string) => m[k];
	it('чтение: пустые значения, лишние пробелы, неизвестная серьёзность отбрасывается', () => {
		expect(readFilters(get({}))).toEqual(emptySecurityFilters());
		expect(readFilters(get({ severity: 'bogus', ip: ' 10.0.0.1 ' }))).toMatchObject({ severity: '', ip: '10.0.0.1' });
	});
	it('несколько типов через запятую → повторяемый параметр, без дублей', () => {
		expect(splitTypes('A, B,A,,')).toEqual(['A', 'B']);
		expect(apiQuery({ ...emptySecurityFilters(), type: 'LOGIN_FAILED,MASS_EXPORT' }).event_type).toEqual(['LOGIN_FAILED', 'MASS_EXPORT']);
		expect(apiQuery(emptySecurityFilters()).event_type).toBeUndefined();
	});
	it('сотрудник — только настоящий UUID; даты — моменты времени', () => {
		const q = apiQuery({ ...emptySecurityFilters(), user: 'не-uuid', from: '2026-10-01', to: '2026-10-02', severity: 'warning' });
		expect(q.user_id).toBeUndefined();
		expect(q.min_severity).toBe('warning');
		expect(q.from).toMatch(/^2026-/);
		expect(apiQuery({ ...emptySecurityFilters(), user: '0192a000-0000-7000-8000-000000000001' }).user_id).toBeTruthy();
	});
	it('описание фильтров для подтверждения выгрузки', () => {
		expect(describeFilters(emptySecurityFilters())).toEqual([]);
		expect(describeFilters({ ...emptySecurityFilters(), type: 'INTEGRATION_SIGNATURE_INVALID', severity: 'critical', from: '2026-10-01', ip: '10.0.0.0/24' })).toEqual([
			'события: Неверная подпись вебхука',
			'серьёзность: не ниже «Критично»',
			'адрес: 10.0.0.0/24',
			'период: с 2026-10-01'
		]);
	});
});

describe('detailRows', () => {
	it('пары «название: значение», вложенные объекты и массивы не ломают строку', () => {
		const rows = detailRows({ kind: 'audit_export', rows: 1968, nested: { a: 1, b: { c: true } }, list: ['x', 'y'], empty: null });
		expect(rows.map((r) => `${r.label}=${r.value}`)).toEqual(['Вид=выгрузка журнала аудита', 'Строк=1968', 'nested.a=1', 'nested.b.c=да', 'list=x, y', 'empty=—']);
		expect(detailRows(null)).toEqual([]);
	});
});

describe('detailRows: известные значения', () => {
	it('причина и контекст неудачного входа — по-русски', () => {
		const rows = detailRows({ reason: 'current_password_invalid', context: 'password_change' });
		expect(rows.map((r) => `${r.label}=${r.value}`)).toEqual(['Причина=неверный текущий пароль', 'Где=смена пароля']);
	});
});

describe('eventLink', () => {
	it('неверная подпись → «Входящие» источника; сброс пароля и отказ → сотрудник; выгрузка → аудит; остальное — без ссылки', () => {
		expect(eventLink({ event_type: 'INTEGRATION_SIGNATURE_INVALID', details: { source: 'cms' } })?.href).toBe('/admin/integrations?tab=inbound&source=cms');
		expect(eventLink({ event_type: 'INTEGRATION_SIGNATURE_INVALID' })?.href).toBe('/admin/integrations?tab=inbound');
		expect(eventLink({ event_type: 'PASSWORD_RESET', user_id: 'u1' })?.href).toBe('/admin/users/u1');
		expect(eventLink({ event_type: 'PERMISSION_DENIED', user_id: null })).toBeNull();
		expect(eventLink({ event_type: 'MASS_EXPORT' })?.href).toBe('/admin/audit?action=AUDIT_EXPORTED');
		expect(eventLink({ event_type: 'LOGIN_FAILED' })).toBeNull();
	});
});

describe('countOf', () => {
	it('сумма по типу и ноль без сводки', () => {
		const s = { by_type: [{ event_type: 'A', count: 2 }, { event_type: 'A', count: 3 }, { event_type: 'B', count: 1 }] };
		expect(countOf(s, 'A')).toBe(5);
		expect(countOf(null, 'A')).toBe(0);
	});
});
