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
		loadPdf: vi.fn(),
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

describe('SignSession.load: отметка ознакомления не записалась (N-4)', () => {
	const failed = () => new ApiError({ status: 422, code: 'CRM-9001' });

	it('POST /view упал, запасной путь есть — документ открыт для чтения, viewPending = true', async () => {
		const loadUnmarked = vi.fn().mockResolvedValue(page('sent'));
		const s = new SignSession(adapter({ load: vi.fn().mockRejectedValue(failed()), loadUnmarked }));
		await s.load();
		expect(s.phase).toBe('ready');
		expect(s.viewPending).toBe(true);
		expect(s.loadError).toBeNull();
	});

	it('чужой запрос (404/403) запасным путём не открывается: ErrorState', async () => {
		const loadUnmarked = vi.fn().mockResolvedValue(page('sent'));
		const notMine = new ApiError({ status: 404, code: 'CRM-9004' });
		const s = new SignSession(adapter({ load: vi.fn().mockRejectedValue(notMine), loadUnmarked }));
		await s.load();
		expect(s.phase).toBe('failed');
		expect(loadUnmarked).not.toHaveBeenCalled();
	});

	it('запасной путь тоже упал — показывается исходная ошибка', async () => {
		const first = failed();
		const s = new SignSession(adapter({ load: vi.fn().mockRejectedValue(first), loadUnmarked: vi.fn().mockRejectedValue(new Error('x')) }));
		await s.load();
		expect(s.phase).toBe('failed');
		expect(s.loadError).toBe(first);
	});

	it('«Подписать» сначала повторяет отметку, потом просит код', async () => {
		const load = vi.fn().mockRejectedValueOnce(failed()).mockResolvedValueOnce(page('viewed'));
		const challenge = vi.fn().mockResolvedValue({ channel: 'sms', expires_in_seconds: 300, sent_to_masked: '+7 *** **12' });
		const s = new SignSession(adapter({ load, loadUnmarked: vi.fn().mockResolvedValue(page('sent')), challenge }));
		await s.load();
		await s.start();
		expect(load).toHaveBeenCalledTimes(2);
		expect(s.viewPending).toBe(false);
		expect(s.phase).toBe('otp');
	});

	it('повторная отметка снова не прошла — подпись не блокируется', async () => {
		const challenge = vi.fn().mockResolvedValue({ channel: 'sms', expires_in_seconds: 300, sent_to_masked: '+7 *** **12' });
		const s = new SignSession(adapter({ load: vi.fn().mockRejectedValue(failed()), loadUnmarked: vi.fn().mockResolvedValue(page('sent')), challenge }));
		await s.load();
		await s.start();
		expect(s.viewPending).toBe(true);
		expect(s.phase).toBe('otp');
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

describe('SignSession.loadPdf — один запрос на страницу (лимит ссылки 10 в минуту)', () => {
	const withDoc = (file_url: string | null) => ({ agreement_text: 'текст', document: { title: 'КП', file_url, preview_url: 'http://s3/x.pdf' }, my_request_id: 'r', my_status: 'viewed', signers: [] }) as never;
	const bytes = (n: number) => new Uint8Array(n).buffer;

	it('file_url есть — идёт адаптер (auto); повторные вызовы, возврат с шага кода и повторный start() запроса не повторяют', async () => {
		const loadPdf = vi.fn().mockResolvedValue(bytes(3));
		const s = new SignSession(adapter({ load: vi.fn().mockResolvedValue(withDoc('/public/sign/t/file')), loadPdf, challenge: vi.fn().mockResolvedValue({ debug_code: '123456' }) }));
		await s.load();

		const first = await s.loadPdf();
		await s.loadPdf();
		await s.start();
		s.back();
		await s.start();
		await s.loadPdf();

		expect(first.byteLength).toBe(3);
		expect(loadPdf).toHaveBeenCalledTimes(1);
		expect(loadPdf).toHaveBeenCalledWith('auto');
	});

	it('одновременные вызовы делят один запрос', async () => {
		let resolve!: (v: ArrayBuffer) => void;
		const loadPdf = vi.fn().mockReturnValue(new Promise<ArrayBuffer>((r) => (resolve = r)));
		const s = new SignSession(adapter({ load: vi.fn().mockResolvedValue(withDoc('/f')), loadPdf }));
		await s.load();

		const a = s.loadPdf();
		const b = s.loadPdf();
		resolve(bytes(1));
		await Promise.all([a, b]);

		expect(loadPdf).toHaveBeenCalledTimes(1);
	});

	it('ошибка не кэшируется: «Повторить» делает новый запрос', async () => {
		const loadPdf = vi.fn().mockRejectedValueOnce(new ApiError({ status: 429, code: 'CRM-8429', retryAfter: 30 })).mockResolvedValueOnce(bytes(2));
		const s = new SignSession(adapter({ load: vi.fn().mockResolvedValue(withDoc('/f')), loadPdf }));
		await s.load();

		await expect(s.loadPdf()).rejects.toBeInstanceOf(ApiError);
		await Promise.resolve();
		expect((await s.loadPdf()).byteLength).toBe(2);
		expect(loadPdf).toHaveBeenCalledTimes(2);
	});

	it('без file_url адаптер не трогается — запасной путь по preview_url обычным fetch', async () => {
		const loadPdf = vi.fn();
		const fetchMock = vi.fn().mockResolvedValue(new Response(bytes(4), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		try {
			const s = new SignSession(adapter({ load: vi.fn().mockResolvedValue(withDoc(null)), loadPdf }));
			await s.load();
			expect((await s.loadPdf()).byteLength).toBe(4);
			expect(loadPdf).not.toHaveBeenCalled();
			expect(fetchMock.mock.calls[0][0]).toBe('http://s3/x.pdf');
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('SignSession после подписи', () => {
	it('перечитывает сведения о документе (is_signed, has_protocol) без смены экрана', async () => {
		const before = { agreement_text: 't', document: { title: 'КП', is_signed: false, has_protocol: false }, my_request_id: 'r', my_status: 'viewed', signers: [] } as never;
		const after = { agreement_text: 't', document: { title: 'КП', is_signed: true, has_protocol: true }, my_request_id: 'r', my_status: 'signed', signers: [] } as never;
		const load = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
		const s = new SignSession(adapter({ load, challenge: vi.fn().mockResolvedValue({}), sign: vi.fn().mockResolvedValue({ id: 'sig' }) }));
		await s.load();
		await s.start();
		s.setOtp('123456');
		await s.submit();
		await vi.waitFor(() => expect(s.page?.document.is_signed).toBe(true));

		expect(s.phase).toBe('done');
		expect(s.outcome).toBe('signed');
		expect(s.page?.document.has_protocol).toBe(true);
	});

	it('download: auto → подписанный файл, protocol → протокол; ошибка адаптера пробрасывается для toast', async () => {
		const loadPdf = vi.fn().mockRejectedValue(new ApiError({ status: 429, code: 'CRM-8429' }));
		const s = new SignSession(adapter({ loadPdf }));
		await expect(s.download('protocol')).rejects.toBeInstanceOf(ApiError);
		expect(loadPdf).toHaveBeenCalledWith('protocol');
	});
});
