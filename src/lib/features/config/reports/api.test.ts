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

describe('fetchReportData: полный ответ', () => {
	it('отдаёт примечание, время построения и признаки усечения без потерь', async () => {
		const body = { title: 'Воронка', columns: ['Статус'], rows: [['Новая']], note: 'Источник: материализованное представление', generated_at: '2026-10-16T11:35:00Z', row_count: 1, total_rows: 9, truncated: true };
		get.mockResolvedValue(ok(body));
		const { fetchReportData } = await load();
		expect(await fetchReportData('report-1')).toEqual(body);
	});
});

describe('лимиты', () => {
	it('лимит отчётов — CRM-1601 или 429 с текстом про незавершённые; другой 429 — общий лимит запросов', async () => {
		const { isReportLimit, isTooManyRequests } = await load();
		const { ApiError } = await import('$lib/api');
		expect(isReportLimit(new ApiError({ status: 429, code: 'CRM-1601' }))).toBe(true);
		expect(isReportLimit(new ApiError({ status: 409, code: 'CRM-1601' }))).toBe(true);
		expect(isReportLimit(new ApiError({ status: 429, detail: 'Не завершено отчётов: 10 (лимит 10)' }))).toBe(true);
		expect(isReportLimit(new ApiError({ status: 429, code: 'CRM-8429' }))).toBe(false);
		expect(isTooManyRequests(new ApiError({ status: 429, code: 'CRM-8429' }))).toBe(true);
		expect(isTooManyRequests(new ApiError({ status: 429, code: 'CRM-1601' }))).toBe(false);
		expect(isReportLimit(new ApiError({ status: 500 }))).toBe(false);
		expect(isReportLimit(new Error('x'))).toBe(false);
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

	it('410 — срок хранения истёк или файла нет (ReportExpired, он же ReportFailed)', async () => {
		get.mockResolvedValue(fail(410, { detail: 'нет файла', code: 'CRM-1603' }));
		const { reportUrl, ReportExpired, ReportFailed } = await load();
		const e = await reportUrl('job-1').catch((x) => x);
		expect(e).toBeInstanceOf(ReportExpired);
		expect(e).toBeInstanceOf(ReportFailed);
	});

	it('409 — отчёт ещё не готов (ReportNotReady)', async () => {
		get.mockResolvedValue(fail(409, { code: 'CRM-1602' }));
		const { reportUrl, ReportNotReady } = await load();
		await expect(reportUrl('job-1')).rejects.toBeInstanceOf(ReportNotReady);
	});

	it('422 и 500 больше не подменяются', async () => {
		const { reportUrl, ReportFailed } = await load();
		for (const status of [422, 500]) {
			get.mockResolvedValue(fail(status, { detail: 'boom' }));
			await expect(reportUrl('job-1')).rejects.not.toBeInstanceOf(ReportFailed);
		}
	});
});

describe('downloadReportJson', () => {
	it('запрашивает /data один раз и отдаёт блоб application/json с исходными полями', async () => {
		const body = { title: 'Сделки', columns: ['Вуз'], rows: [['МГТУ']], note: null, generated_at: '2026-10-16T11:35:12Z', row_count: 1 };
		get.mockResolvedValue(ok(body));
		const { downloadReportJson } = await load();
		const saved: { blob: Blob; name: string }[] = [];
		await downloadReportJson({ id: 'job-1' }, 'Сделки по вузам', (blob, name) => saved.push({ blob, name }));
		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('/api/reports/{report_id}/data', expect.objectContaining({ params: { path: { report_id: 'job-1' } } }));
		expect(saved).toHaveLength(1);
		expect(saved[0].blob.type).toBe('application/json');
		expect(saved[0].name).toMatch(/^Сделки_по_вузам_\d{4}-\d{2}-\d{2}\.json$/);
		expect(JSON.parse(await saved[0].blob.text())).toEqual(body);
		expect(await saved[0].blob.text()).toContain('{\n  "title"');
	});

	it('403 (отчёт только файлом) не превращается в успех и ничего не сохраняет', async () => {
		get.mockResolvedValue(fail(403, { code: 'CRM-1102', detail: 'Только файлом' }));
		const { downloadReportJson } = await load();
		let saved = 0;
		await expect(downloadReportJson({ id: 'job-1' }, 'LMS', () => saved++)).rejects.toThrow();
		expect(saved).toBe(0);
	});
});

describe('countUnfinished', () => {
	it('считает только задания в очереди и в обработке', async () => {
		get.mockResolvedValue(ok({ items: [job({ status: 'queued' }), job({ status: 'processing' }), job({ status: 'completed' }), job({ status: 'failed' })] }));
		const { countUnfinished } = await load();
		expect(await countUnfinished()).toBe(2);
		expect(get).toHaveBeenCalledWith('/api/reports', { params: { query: { limit: 50 } } });
	});
});

describe('waitForReport', () => {
	it('onUpdate вызывается на каждом опросе', async () => {
		get.mockResolvedValueOnce(ok(job({ status: 'processing' }))).mockResolvedValueOnce(ok(job({ status: 'completed' })));
		const { waitForReport } = await load();
		const seen: string[] = [];
		await waitForReport(job({ status: 'queued' }), { interval: 0, onUpdate: (j) => seen.push(j.status) });
		expect(seen).toEqual(['processing', 'completed']);
	});

	it('таймаут — ReportStillRunning с заданием, а не ReportFailed', async () => {
		get.mockResolvedValue(ok(job({ status: 'queued' })));
		const { waitForReport, ReportStillRunning, ReportFailed } = await load();
		const e = await waitForReport(job({ status: 'queued' }), { interval: 0, timeout: -1 }).catch((x) => x);
		expect(e).toBeInstanceOf(ReportStillRunning);
		expect(e).not.toBeInstanceOf(ReportFailed);
		expect(e.job.status).toBe('queued');
	});

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
