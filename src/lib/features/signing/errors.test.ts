import { describe, expect, it } from 'vitest';
import { signErrorMessage } from './errors';

describe('signErrorMessage', () => {
	it('недействительная ссылка — фатально', () => {
		expect(signErrorMessage({ code: 'CRM-1504', detail: 'Ссылка недействительна' })).toMatchObject({ kind: 'token_invalid', fatal: true });
	});

	it('различает варианты CRM-1503 по тексту', () => {
		expect(signErrorMessage({ code: 'CRM-1503', detail: 'Код подтверждения неверен' }).kind).toBe('invalid_code');
		expect(signErrorMessage({ code: 'CRM-1503', detail: 'Срок действия кода истёк' }).kind).toBe('code_expired');
		expect(signErrorMessage({ code: 'CRM-1503', detail: 'Превышен лимит отправок кода на этот запрос' }).kind).toBe('send_limit');
		expect(signErrorMessage({ code: 'CRM-1503', detail: 'Код не запрашивался или уже использован' }).kind).toBe('code_missing');
	});

	it('CRM-1505 читает статус из extra', () => {
		expect(signErrorMessage({ code: 'CRM-1505', extra: { status: 'locked' } })).toMatchObject({ kind: 'locked', fatal: true });
		expect(signErrorMessage({ code: 'CRM-1505', extra: { status: 'signed' } }).kind).toBe('already_signed');
		expect(signErrorMessage({ code: 'CRM-1505', extra: { status: 'pending' } })).toMatchObject({ kind: 'not_signable', fatal: false });
	});

	it('хэш и время', () => {
		expect(signErrorMessage({ code: 'CRM-1502' })).toMatchObject({ kind: 'hash_mismatch', fatal: true });
		expect(signErrorMessage({ code: 'CRM-1506' })).toMatchObject({ kind: 'time_untrusted', fatal: false });
	});

	it('429 несёт Retry-After в тексте', () => {
		const e = signErrorMessage({ code: 'CRM-8429', retryAfter: 42.2 });
		expect(e).toMatchObject({ kind: 'rate_limited', retryAfter: 43 });
		expect(e.message).toContain('43');
	});

	it('нет канала связи', () => {
		expect(signErrorMessage({ code: 'CRM-1001', detail: 'У подписанта нет верифицированного канала связи' }).kind).toBe('no_channel');
	});

	it('неизвестное — текст бэкенда или запасной', () => {
		expect(signErrorMessage({ code: 'CRM-9000', detail: 'Упало' }).message).toBe('Упало');
		expect(signErrorMessage({}).message).toContain('Попробуйте');
	});
});
