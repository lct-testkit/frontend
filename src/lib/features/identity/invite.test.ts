import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api';
import { InviteFlow, type InviteAdapter } from './invite.svelte';

const invite = { valid: true, email_masked: 'e***@example.com', full_name: 'Иван', expires_at: '2026-10-21T00:00:00Z', login_url: 'http://x/api/auth/login' };
const GOOD = 'Correct-Horse-12';

function adapter(overrides: Partial<InviteAdapter> = {}): InviteAdapter {
	return {
		check: vi.fn().mockResolvedValue(invite),
		setPassword: vi.fn().mockResolvedValue({ login_url: 'http://x/api/auth/login', ok: true }),
		...overrides
	};
}
const problem = (status: number, init: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) => new ApiError({ status, ...init });

describe('InviteFlow.load', () => {
	it('валидная ссылка — фаза ready', async () => {
		const f = new InviteFlow(adapter());
		await f.load('t'.repeat(20));
		expect(f.phase).toBe('ready');
		expect(f.invite?.full_name).toBe('Иван');
	});
	it('404 — ссылка недействительна, 429 — с Retry-After, сеть — failed', async () => {
		const f404 = new InviteFlow(adapter({ check: vi.fn().mockRejectedValue(problem(404)) }));
		await f404.load('x');
		expect(f404.phase).toBe('invalid');
		const f429 = new InviteFlow(adapter({ check: vi.fn().mockRejectedValue(problem(429, { retryAfter: 42 })) }));
		await f429.load('x');
		expect(f429.phase).toBe('invalid');
		expect(f429.retryAfter).toBe(42);
		const net = new InviteFlow(adapter({ check: vi.fn().mockRejectedValue(ApiError.network()) }));
		await net.load('x');
		expect(net.phase).toBe('failed');
	});
});

describe('InviteFlow.submit', () => {
	it('пароль принят — фаза done, адрес входа сохранён', async () => {
		const a = adapter();
		const f = new InviteFlow(a);
		await f.load('tok');
		expect(await f.submit(GOOD, GOOD)).toBe(true);
		expect(f.phase).toBe('done');
		expect(f.loginUrl).toBe('http://x/api/auth/login');
		expect(a.setPassword).toHaveBeenCalledWith('tok', GOOD, GOOD);
	});
	it('слабый пароль и несовпадение не уходят на сервер', async () => {
		const a = adapter();
		const f = new InviteFlow(a);
		await f.load('tok');
		expect(await f.submit('short', 'short')).toBe(false);
		expect(await f.submit(GOOD, GOOD + 'x')).toBe(false);
		expect(a.setPassword).not.toHaveBeenCalled();
	});
	it('422 раскладывает причину под поле пароля, фаза остаётся ready', async () => {
		const f = new InviteFlow(adapter({ setPassword: vi.fn().mockRejectedValue(problem(422, { detail: 'Invalid password: must contain at least 1 upper case characters.', errors: [{ field: 'new_password', reason: 'не соответствует политике' }] })) }));
		await f.load('tok');
		expect(await f.submit(GOOD, GOOD)).toBe(false);
		expect(f.phase).toBe('ready');
		expect(f.errors.next).toBe('Нужна хотя бы одна заглавная буква');
	});
	it('429 даёт retryAfter, 404 после успеха — ссылка недействительна', async () => {
		const f = new InviteFlow(adapter({ setPassword: vi.fn().mockRejectedValue(problem(429, { retryAfter: 30 })) }));
		await f.load('tok');
		await f.submit(GOOD, GOOD);
		expect(f.retryAfter).toBe(30);
		expect(f.errors.form).toBeTruthy();
		const gone = new InviteFlow(adapter({ setPassword: vi.fn().mockRejectedValue(problem(404)) }));
		await gone.load('tok');
		await gone.submit(GOOD, GOOD);
		expect(gone.phase).toBe('invalid');
	});
	it('повторная отправка при submitting игнорируется', async () => {
		let release: (v: { login_url: string }) => void = () => {};
		const setPassword = vi.fn().mockReturnValue(new Promise((res) => (release = res)));
		const f = new InviteFlow(adapter({ setPassword }));
		await f.load('tok');
		const first = f.submit(GOOD, GOOD);
		expect(f.phase).toBe('submitting');
		expect(await f.submit(GOOD, GOOD)).toBe(false);
		release({ login_url: 'u' });
		await first;
		expect(setPassword).toHaveBeenCalledTimes(1);
	});
});
