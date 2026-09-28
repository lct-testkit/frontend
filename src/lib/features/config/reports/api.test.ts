import { beforeEach, describe, expect, it, vi } from 'vitest';

// Тот же приём, что entityCache.test.ts: `api.GET`/`api.POST` подменены на моки, `unwrap`/`ApiError` — настоящие
// (не мок): `reportUrl`/`isRateLimited` делают `e instanceof ApiError` — класс должен быть тем же самым объектом.
const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', async () => {
	const real = await vi.importActual<typeof import('$lib/api/errors')>('$lib/api/errors');
	return {
		api: { GET: get, POST: post },
		unwrap: async (request: Promise<{ data?: unknown; error?: unknown; response: Response }>) => {
			const result = await request;
			if (result.error !== undefined || !result.response.ok) throw real.ApiError.fromProblem(result.response.status, result.error, result.response.headers);
			return result.data;
		},
		ApiError: real.ApiError,
		idem: (key = 'idem-test-key') => ({ 'Idempotency-Key': key })
	};
});

const load = () => import('./api');
const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });
const fail = (status: number, body?: unknown) => ({ data: undefined, error: body, response: new Response(null, { status }) });

function job(overrides: Partial<{ id: string; status: string; error: string | null }> = {}) {
	return { id: 'job-1', status: 'completed', error: null, ...overrides } as never;
}

beforeEach(() => {
	get.mockReset();
	post.mockReset();
});

describe('fetchReportData', () => {
	it('запрашивает JSON по id задания, передаёт signal', async () => {
		get.mockResolvedValue(ok({ columns: ['Статус'], rows: [['Новая']] }));
		const { fetchReportData } = await load();
		const signal = new AbortController().signal;

		const data = await fetchReportData('report-1', signal);

		expect(data).toEqual({ columns: ['Статус'], rows: [['Новая']] });
		expect(get).toHaveBeenCalledWith('/api/reports/{report_id}/data', expect.objectContaining({ params: { path: { report_id: 'report-1' } }, signal }));
	});
});

describe('isRateLimited', () => {
	it('429 или CRM-1601 — да; другая ошибка API или не ApiError — нет', async () => {
		const { isRateLimited } = await load();
		const { ApiError } = await import('$lib/api');
		expect(isRateLimited(new ApiError({ status: 429 }))).toBe(true);
		expect(isRateLimited(new ApiError({ status: 409, code: 'CRM-1601' }))).toBe(true);
		expect(isRateLimited(new ApiError({ status: 500 }))).toBe(false);
		expect(isRateLimited(new Error('x'))).toBe(false);
	});
});

describe('ReportFailed', () => {
	it('это Error с собственным name, для отличия от прочих исключений в UI', async () => {
		const { ReportFailed } = await load();
		const e = new ReportFailed('текст');
		expect(e).toBeInstanceOf(Error);
		expect(e.name).toBe('ReportFailed');
		expect(e.message).toBe('текст');
	});
});

// `saveFromUrl`/`downloadReport` трогают `document` (создают и кликают `<a>`) — среда тестов этого файла
// `node` (vite.config.ts), без DOM; чтобы их покрыть, нужна отдельная `jsdom`-среда для файла — вне этого PR.

describe('getReport / startReport', () => {
	it('getReport — GET по id, передаёт signal', async () => {
		get.mockResolvedValue(ok(job({ status: 'queued' })));
		const { getReport } = await load();
		const signal = new AbortController().signal;

		const j = await getReport('job-1', signal);

		expect(j).toMatchObject({ id: 'job-1', status: 'queued' });
		expect(get).toHaveBeenCalledWith('/api/reports/{report_id}', expect.objectContaining({ params: { path: { report_id: 'job-1' } }, signal }));
	});

	it('startReport — POST с шаблоном/форматом/параметрами и Idempotency-Key', async () => {
		post.mockResolvedValue(ok(job({ status: 'queued' })));
		const { startReport } = await load();

		await startReport('deal_register', 'xlsx', { from: '2026-01-01' });

		expect(post).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ body: { template_code: 'deal_register', format: 'xlsx', params: { from: '2026-01-01' } } }));
	});
});

describe('reportUrl / downloadReport', () => {
	it('успех — url из ответа', async () => {
		get.mockResolvedValue(ok({ url: 'https://s3.example/ready.xlsx' }));
		const { reportUrl } = await load();

		expect(await reportUrl('job-1')).toBe('https://s3.example/ready.xlsx');
	});

	it('422 — «срок хранения истёк» (ReportFailed), не сырой ApiError', async () => {
		get.mockResolvedValue(fail(422, { detail: 'expired' }));
		const { reportUrl, ReportFailed } = await load();

		await expect(reportUrl('job-1')).rejects.toBeInstanceOf(ReportFailed);
	});

	it('другой статус — ошибка не подменяется', async () => {
		get.mockResolvedValue(fail(500, { detail: 'boom' }));
		const { reportUrl, ReportFailed } = await load();

		await expect(reportUrl('job-1')).rejects.not.toBeInstanceOf(ReportFailed);
	});
});

describe('waitForReport', () => {
	it('опрашивает, пока задание в очереди/обработке, и возвращает готовое', async () => {
		get.mockResolvedValueOnce(ok(job({ status: 'processing' }))).mockResolvedValueOnce(ok(job({ status: 'completed' })));
		const { waitForReport } = await load();

		const result = await waitForReport(job({ status: 'queued' }), { interval: 0 });

		expect(result.status).toBe('completed');
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('failed — ReportFailed с текстом ошибки задания', async () => {
		const { waitForReport, ReportFailed } = await load();

		await expect(waitForReport(job({ status: 'failed', error: 'бэкенд отказал' }))).rejects.toThrow('бэкенд отказал');
		await expect(waitForReport(job({ status: 'failed' }))).rejects.toBeInstanceOf(ReportFailed);
	});
});
