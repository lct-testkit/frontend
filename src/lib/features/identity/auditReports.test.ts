import { beforeEach, describe, expect, it, vi } from 'vitest';

// Названия отчётов в журнале аудита берутся страницами списка `GET /api/reports`, а не десятками одиночных `GET /api/reports/{id}` (QA2 Н3, Н6).
const get = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', async () => {
	const real = await vi.importActual<typeof import('$lib/api/errors')>('$lib/api/errors');
	return {
		api: { GET: get, POST: vi.fn() },
		unwrap: async (request: Promise<{ data?: unknown; error?: unknown; response: Response }>) => {
			const result = await request;
			if (result.error !== undefined || !result.response.ok) throw real.ApiError.fromProblem(result.response.status, result.error, result.response.headers);
			return result.data;
		},
		ApiError: real.ApiError,
		idem: () => ({})
	};
});

const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });
const rep = (id: string) => ({ id, format: 'xlsx', created_at: '2026-10-19T10:00:00Z' });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => get.mockReset());

describe('названия отчётов в журнале аудита', () => {
	it('один запрос списка вместо запроса на каждый отчёт; чужой/неизвестный отчёт остаётся без названия', async () => {
		get.mockResolvedValue(ok({ items: [rep('r1'), rep('r2')], next_cursor: null }));
		const { session } = await import('$lib/auth/session.svelte');
		session.me = { role: 'HEAD' } as never;
		const { ensureAuditEntities, entityLabel } = await import('./audit');
		ensureAuditEntities([
			{ entity_type: 'report_job', entity_id: 'r1' },
			{ entity_type: 'report_job', entity_id: 'r2' },
			{ entity_type: 'report_job', entity_id: 'foreign' }
		]);
		await flush();
		await flush();
		expect(get).toHaveBeenCalledTimes(1);
		expect(get.mock.calls[0][0]).toBe('/api/reports');
		expect(entityLabel('report_job', 'r1')).toMatch(/^XLSX от /);
		expect(entityLabel('report_job', 'foreign')).toBeNull();
		// повторный показ тех же строк новых запросов не даёт: список кончился
		ensureAuditEntities([{ entity_type: 'report_job', entity_id: 'foreign' }]);
		await flush();
		expect(get).toHaveBeenCalledTimes(1);
	});
});
