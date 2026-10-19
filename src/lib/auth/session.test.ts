import { beforeEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();
const hasTokens = vi.fn();
vi.mock('$lib/config', () => ({ getConfig: () => ({ mode: 'demo' }) }));
vi.mock('./tokens', () => ({ demoLogin: vi.fn(), demoLogout: vi.fn(), hasTokens: () => hasTokens() }));
vi.mock('$lib/api', async () => {
	const errors = await import('$lib/api/errors');
	return {
		api: { GET: (...a: unknown[]) => GET(...a), POST: vi.fn() },
		unwrap: async (p: Promise<{ data?: unknown; error?: unknown; response: { ok: boolean; status: number; headers: Headers } }>) => {
			const r = await p;
			if (!r.response.ok) throw errors.ApiError.fromProblem(r.response.status, r.error, r.response.headers);
			return r.data;
		},
		ApiError: errors.ApiError
	};
});

const { session } = await import('./session.svelte');

const ok = (data: unknown) => ({ data, response: { ok: true, status: 200, headers: new Headers() } });
const unauth = () => ({ error: { status: 401 }, response: { ok: false, status: 401, headers: new Headers() } });
const me = { role: 'KAM', full_name: 'Иван', scopes: [], consent_required: false, password_change_required: false };

beforeEach(() => {
	GET.mockReset();
	hasTokens.mockReset();
	session.reset(null);
});

describe('session.load в demo', () => {
	it('без токенов пробует cookie-сессию BFF: /api/me отвечает — пользователь вошёл', async () => {
		hasTokens.mockReturnValue(false);
		GET.mockResolvedValue(ok(me));
		await session.load();
		expect(GET).toHaveBeenCalledWith('/api/me');
		expect(session.status).toBe('authenticated');
		expect(session.role).toBe('KAM');
	});

	it('без токенов и без cookie (401) — anonymous, без ошибки', async () => {
		hasTokens.mockReturnValue(false);
		GET.mockResolvedValue(unauth());
		await session.load();
		expect(session.status).toBe('anonymous');
		expect(session.error).toBeNull();
	});

	it('с токенами работает как раньше', async () => {
		hasTokens.mockReturnValue(true);
		GET.mockResolvedValue(ok(me));
		await session.load();
		expect(session.status).toBe('authenticated');
	});
});
