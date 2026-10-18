import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
	startReport: vi.fn(),
	waitForReport: vi.fn(),
	countUnfinished: vi.fn(),
	downloadReport: vi.fn(),
	track: vi.fn()
}));

vi.mock('$lib/api', () => ({ errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));
vi.mock('./api', () => {
	class ReportFailed extends Error {}
	class ReportStillRunning extends Error {
		job: unknown;
		constructor(job: unknown) {
			super('still');
			this.job = job;
		}
	}
	return {
		ReportFailed,
		ReportStillRunning,
		isReportLimit: (e: { code?: string }) => e?.code === 'CRM-1601',
		startReport: m.startReport,
		waitForReport: m.waitForReport,
		countUnfinished: m.countUnfinished,
		downloadReport: m.downloadReport
	};
});
vi.mock('./tracker.svelte', () => ({ track: m.track }));

const load = () => import('./run.svelte');
const api = () => import('./api');
const job = (status: string, extra: Record<string, unknown> = {}) => ({ id: 'j1', status, ...extra }) as never;

beforeEach(() => {
	vi.useFakeTimers();
	Object.values(m).forEach((f) => f.mockReset());
});
afterEach(() => vi.useRealTimers());

describe('запуск отчёта', () => {
	it('в очереди → формируется → готово: состояние проходит через оба шага', async () => {
		const { ReportRun } = await load();
		m.startReport.mockResolvedValue(job('queued'));
		m.waitForReport.mockImplementation(async (_job: unknown, opts: { onUpdate: (j: unknown) => void }) => {
			opts.onUpdate(job('processing'));
			opts.onUpdate(job('completed'));
			return job('completed', { row_count: 3 });
		});
		const run = new ReportRun();
		const seen: string[] = [];
		const p = run.run('deal_register', 'xlsx', {});
		seen.push(run.jobStatus);
		await p;
		seen.push(run.jobStatus);
		expect(seen).toEqual(['queued', 'processing']);
		expect(run.phase).toBe('done');
		expect(run.job).toMatchObject({ row_count: 3 });
		run.dispose();
	});

	it('429 лимит отчётов: фаза «limit», текст сервера и число из него; «Повторить» ждёт освобождения слота', async () => {
		const { ReportRun } = await load();
		const detail = 'Не завершено отчётов: 10 (лимит 10). Дождитесь готовности запущенных и повторите';
		m.startReport.mockRejectedValue(Object.assign(new Error(detail), { code: 'CRM-1601' }));
		m.countUnfinished.mockResolvedValueOnce(10).mockResolvedValueOnce(9);
		const run = new ReportRun();
		await run.run('stuck_deals', 'xlsx', {});
		expect(run.phase).toBe('limit');
		expect(run.message).toBe(detail);
		expect(run.limit).toBe(10);

		await vi.advanceTimersByTimeAsync(10);
		expect(run.unfinished).toBe(10);
		expect(run.canRetry).toBe(false);
		await vi.advanceTimersByTimeAsync(3000);
		expect(run.unfinished).toBe(9);
		expect(run.canRetry).toBe(true);
		run.dispose();
	});

	it('таймаут ожидания живого задания — «background», а не «failed», и отслеживание уходит в tracker', async () => {
		const { ReportRun } = await load();
		const { ReportStillRunning } = await api();
		m.startReport.mockResolvedValue(job('queued'));
		m.waitForReport.mockRejectedValue(new ReportStillRunning(job('queued')));
		const run = new ReportRun();
		await run.run('deal_register', 'xlsx', {}, 'Сделки по вузам');
		expect(run.phase).toBe('background');
		expect(m.track).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1' }), 'Сделки по вузам');
		run.dispose();
	});

	it('другая ошибка — «failed» с текстом', async () => {
		const { ReportRun } = await load();
		const { ReportFailed } = await api();
		m.startReport.mockResolvedValue(job('queued'));
		m.waitForReport.mockRejectedValue(new ReportFailed('бэкенд отказал'));
		const run = new ReportRun();
		await run.run('deal_register', 'xlsx', {});
		expect(run.phase).toBe('failed');
		expect(run.message).toBe('бэкенд отказал');
		run.dispose();
	});

	it('«Свернуть» отдаёт задание tracker и возвращает панель к форме', async () => {
		const { ReportRun } = await load();
		m.startReport.mockResolvedValue(job('queued'));
		m.waitForReport.mockImplementation(() => new Promise(() => {}));
		const run = new ReportRun();
		void run.run('deal_register', 'xlsx', {}, 'Реестр');
		await vi.advanceTimersByTimeAsync(0);
		run.minimize();
		expect(m.track).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1' }), 'Реестр');
		expect(run.phase).toBe('form');
		run.dispose();
	});

	it('счётчик времени идёт раз в секунду и формат «0:12»', async () => {
		const { ReportRun, clock, limitFrom } = await load();
		m.startReport.mockResolvedValue(job('queued'));
		m.waitForReport.mockImplementation(() => new Promise(() => {}));
		const run = new ReportRun();
		void run.run('deal_register', 'xlsx', {});
		await vi.advanceTimersByTimeAsync(12_000);
		expect(run.elapsed).toBe(12);
		expect(clock(12)).toBe('0:12');
		expect(clock(75)).toBe('1:15');
		expect(limitFrom('лимит 7')).toBe(7);
		expect(limitFrom('что-то')).toBe(10);
		run.dispose();
	});
});
