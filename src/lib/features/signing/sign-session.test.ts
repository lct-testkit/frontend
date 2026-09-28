import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api';
import { SignSession } from './sign-session.svelte';
import type { SignAdapter } from './api';
import { OTP_DEFAULT_MAX_ATTEMPTS, OTP_MAX_SENDS } from './otp';

// `SignSession` не знает про сеть напрямую — только про `SignAdapter` (см. api.ts), поэтому
// тест подставляет свой адаптер, а не мокает `$lib/api`: `ApiError` берём настоящий (не мок),
// иначе `instanceof ApiError` внутри `#onError` не сработает.

function adapter(overrides: Partial<SignAdapter> = {}): SignAdapter {
	return {
		load: vi.fn(),
		challenge: vi.fn(),
		sign: vi.fn(),
		reject: vi.fn(),
		...overrides
	};
}

const page = (my_status = 'awaiting') =>
	({ agreement_text: 'текст', document: {}, my_request_id: 'req-1', my_status, signers: [] }) as never;

const notSignable = (status: string, detail = '') => new ApiError({ status: 409, code: 'CRM-1505', detail, extra: { status } });

describe('SignSession.load', () => {
	it('успех, статус не терминальный — фаза ready', async () => {
		const s = new SignSession(adapter({ load: vi.fn().mockResolvedValue(page('awaiting')) }));
		await s.load();
		expect(s.phase).toBe('ready');
		expect(s.outcome).toBeNull();
	});

	it('успех, статус signed/pending — сразу закрывается терминальным исходом', async () => {
		const signed = new SignSession(adapter({ load: vi.fn().mockResolvedValue(page('signed')) }));
		await signed.load();
		expect(signed.phase).toBe('closed');
		expect(signed.outcome).toBe('signed_before');

		const pending = new SignSession(adapter({ load: vi.fn().mockResolvedValue(page('pending')) }));
		await pending.load();
		expect(pending.outcome).toBe('waiting');
	});

	it('CRM-1504 (токен недействителен) — invalid, а не «failed»', async () => {
		const s = new SignSession(adapter({ load: vi.fn().mockRejectedValue(new ApiError({ status: 404, code: 'CRM-1504' })) }));
		await s.load();
		expect(s.phase).toBe('closed');
		expect(s.outcome).toBe('invalid');
	});

	it('прочая ошибка — фаза failed, loadError сохранён (страница показывает ErrorState)', async () => {
		const boom = new Error('network down');
		const s = new SignSession(adapter({ load: vi.fn().mockRejectedValue(boom) }));
		await s.load();
		expect(s.phase).toBe('failed');
		expect(s.loadError).toBe(boom);
	});
});

describe('SignSession.start / back / setOtp', () => {
	it('start — переходит в otp и запрашивает код, если его ещё нет', async () => {
		const challenge = vi.fn().mockResolvedValue({ channel: 'sms', expires_in_seconds: 300, sent_to_masked: '+7 *** **12' });
		const s = new SignSession(adapter({ challenge }));
		await s.start();
		expect(s.phase).toBe('otp');
		expect(challenge).toHaveBeenCalledTimes(1);
	});

	it('start — код не запрашивается повторно, если уже есть (после back)', async () => {
		const challenge = vi.fn().mockResolvedValue({ channel: 'sms', expires_in_seconds: 300, sent_to_masked: '+7 *** **12' });
		const s = new SignSession(adapter({ challenge }));
		await s.start();
		s.back();
		await s.start();
		expect(challenge).toHaveBeenCalledTimes(1);
	});

	it('back — только из otp и только не во время busy; чистит сообщение об ошибке', async () => {
		const s = new SignSession(adapter({ challenge: vi.fn().mockResolvedValue({ channel: 'sms', expires_in_seconds: 300, sent_to_masked: '+7' }) }));
		await s.start();
		s.message = 'ошибка';
		s.back();
		expect(s.phase).toBe('ready');
		expect(s.message).toBeNull();

		s.busy = true;
		s.phase = 'otp';
		s.back();
		expect(s.phase).toBe('otp'); // занято — не ушли назад
	});

	it('setOtp — только цифры, режет до длины кода, чистит сообщение', () => {
		const s = new SignSession(adapter());
		s.message = 'было';
		s.setOtp('12-34 56789');
		expect(s.otp).toBe('123456');
		expect(s.message).toBeNull();
	});
});

describe('SignSession.requestCode', () => {
	it('успех — новый challenge, счётчик отправок растёт, таймер и otp сбрасываются', async () => {
		const s = new SignSession(adapter());
		s.otp = '999999';
		s.sends = 1;
		await s.requestCode();
		await s.requestCode();
		expect(s.sends).toBe(1 + 2); // стартовое 1 + два вызова
		expect(s.otp).toBe('');
		expect(s.cooldown).toBe(60);
	});

	it('занято (busy) — повторный вызов игнорируется', async () => {
		const challenge = vi.fn().mockResolvedValue({ channel: 'sms', expires_in_seconds: 300, sent_to_masked: '+7' });
		const s = new SignSession(adapter({ challenge }));
		s.busy = true;
		await s.requestCode();
		expect(challenge).not.toHaveBeenCalled();
	});
});

describe('SignSession.submit — исходы подписи', () => {
	async function inOtp(over: Partial<SignAdapter> = {}) {
		const s = new SignSession(adapter({ challenge: vi.fn().mockResolvedValue({ channel: 'sms', expires_in_seconds: 300, sent_to_masked: '+7' }), ...over }));
		await s.start();
		s.otp = '123456';
		return s;
	}

	it('вне фазы otp или неполный код — submit ничего не делает', async () => {
		const sign = vi.fn();
		const s = await inOtp({ sign });
		s.otp = '123'; // неполный
		await s.submit();
		expect(sign).not.toHaveBeenCalled();
	});

	it('успех — подпись сохранена, done/signed', async () => {
		const signature = { id: 'sig-1' } as never;
		const s = await inOtp({ sign: vi.fn().mockResolvedValue(signature) });
		await s.submit();
		expect(s.phase).toBe('done');
		expect(s.outcome).toBe('signed');
		expect(s.signature).toBe(signature);
	});

	it('неверный код (CRM-1503) — остаётся в otp, считает попытки, показывает остаток', async () => {
		const err = new ApiError({ status: 422, code: 'CRM-1503', detail: 'Код неверен' });
		const s = await inOtp({ sign: vi.fn().mockRejectedValue(err) });
		await s.submit();
		expect(s.phase).toBe('otp');
		expect(s.failed).toBe(1);
		expect(s.otp).toBe('');
		expect(s.message).toContain(String(OTP_DEFAULT_MAX_ATTEMPTS - 1));
	});

	it('неверный код исчерпал попытки — сообщение без «осталось попыток» (attemptsLeft = 0)', async () => {
		const err = new ApiError({ status: 422, code: 'CRM-1503', detail: 'Код неверен' });
		const s = await inOtp({ sign: vi.fn().mockRejectedValue(err) });
		s.failed = OTP_DEFAULT_MAX_ATTEMPTS - 1;
		await s.submit();
		expect(s.attemptsLeft).toBe(0);
		expect(s.message).toBe('Код неверен. Проверьте цифры и попробуйте ещё раз.');
	});

	it('CRM-1502 (файл изменился) — фатальная mismatch, диалог закрывается', async () => {
		const err = new ApiError({ status: 409, code: 'CRM-1502' });
		const s = await inOtp({ sign: vi.fn().mockRejectedValue(err) });
		await s.submit();
		expect(s.phase).toBe('closed');
		expect(s.outcome).toBe('mismatch');
	});

	it('CRM-1505 status=locked/signed — закрывается тем же исходом, без общего invalid', async () => {
		const locked = await inOtp({ sign: vi.fn().mockRejectedValue(notSignable('locked')) });
		await locked.submit();
		expect(locked.outcome).toBe('locked');

		const already = await inOtp({ sign: vi.fn().mockRejectedValue(notSignable('signed')) });
		await already.submit();
		expect(already.outcome).toBe('signed_before');
	});

	it('CRM-1505 status=expired/void — закрывается соответствующим терминальным исходом', async () => {
		const expired = await inOtp({ sign: vi.fn().mockRejectedValue(notSignable('expired')) });
		await expired.submit();
		expect(expired.outcome).toBe('expired');
		expect(expired.note).toBe('Срок подписания истёк.');

		const voided = await inOtp({ sign: vi.fn().mockRejectedValue(notSignable('void')) });
		await voided.submit();
		expect(voided.outcome).toBe('void');
	});

	it('CRM-1505 status=pending — не наша очередь: НЕ закрывается, только сообщение (fatal=false)', async () => {
		const s = await inOtp({ sign: vi.fn().mockRejectedValue(notSignable('pending')) });
		await s.submit();
		expect(s.phase).toBe('otp');
		expect(s.outcome).toBeNull();
		expect(s.message).toBe('Сейчас не ваша очередь: документ подписывает предыдущий участник.');
	});

	it('CRM-8429 (rate limit) — не закрывается, растягивает cooldown по Retry-After', async () => {
		const err = new ApiError({ status: 429, code: 'CRM-8429', retryAfter: 45 });
		const s = await inOtp({ sign: vi.fn().mockRejectedValue(err) });
		await s.submit();
		expect(s.phase).toBe('otp');
		expect(s.cooldown).toBe(45);
		expect(s.message).toContain('45');
	});

	it('сетевая ошибка — детальный текст ApiError.network, не закрывается', async () => {
		const s = await inOtp({ sign: vi.fn().mockRejectedValue(ApiError.network(new TypeError('fetch failed'))) });
		await s.submit();
		expect(s.phase).toBe('otp');
		expect(s.message).toBe(ApiError.network().detail);
	});

	it('не-ApiError исключение — общее сообщение, не закрывается', async () => {
		const s = await inOtp({ sign: vi.fn().mockRejectedValue(new Error('boom')) });
		await s.submit();
		expect(s.phase).toBe('otp');
		expect(s.message).toBe('Не удалось выполнить действие. Проверьте соединение и повторите.');
	});
});

describe('SignSession.requestCode — те же ошибки во время отправки (during: send)', () => {
	it('CRM-1503 во время отправки — не увеличивает failed (счётчик неверных попыток относится к submit, не к send)', async () => {
		const s = new SignSession(adapter({ challenge: vi.fn().mockRejectedValue(new ApiError({ status: 422, code: 'CRM-1503', detail: 'плохо' })) }));
		await s.requestCode();
		expect(s.failed).toBe(0);
		expect(s.message).toBe('Код неверен. Проверьте цифры и попробуйте ещё раз.');
	});

	it('лимит отправок (CRM-1503, «лимит» в detail) — sends выставляется в максимум', async () => {
		const s = new SignSession(adapter({ challenge: vi.fn().mockRejectedValue(new ApiError({ status: 422, code: 'CRM-1503', detail: 'Исчерпан лимит отправок' })) }));
		await s.requestCode();
		expect(s.sends).toBe(OTP_MAX_SENDS);
		expect(s.sendsExhausted).toBe(true);
	});
});

describe('SignSession.reject', () => {
	it('успех — закрывается с исходом rejected', async () => {
		const reject = vi.fn().mockResolvedValue(undefined);
		const s = new SignSession(adapter({ reject }));
		await s.reject('  не мой документ  ');
		expect(reject).toHaveBeenCalledWith('не мой документ'); // обрезает пробелы
		expect(s.phase).toBe('done');
		expect(s.outcome).toBe('rejected');
	});

	it('CRM-1504 — invalid, как и при load/submit', async () => {
		const s = new SignSession(adapter({ reject: vi.fn().mockRejectedValue(new ApiError({ status: 404, code: 'CRM-1504' })) }));
		await s.reject('причина');
		expect(s.outcome).toBe('invalid');
	});

	it('прочая ошибка — не глушится, пробрасывается вызывающему', async () => {
		const s = new SignSession(adapter({ reject: vi.fn().mockRejectedValue(new Error('boom')) }));
		await expect(s.reject('причина')).rejects.toThrow('boom');
		expect(s.busy).toBe(false); // finally всё равно снял busy
	});
});

describe('SignSession — производные геттеры', () => {
	it('debugCode — из последнего challenge, иначе null', async () => {
		const s = new SignSession(adapter({ challenge: vi.fn().mockResolvedValue({ channel: 'sms', expires_in_seconds: 300, sent_to_masked: '+7', debug_code: '000000' }) }));
		expect(s.debugCode).toBeNull();
		await s.requestCode();
		expect(s.debugCode).toBe('000000');
	});
});
