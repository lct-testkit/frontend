import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ getReport: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('./api', () => ({ getReport: m.getReport }));
vi.mock('$lib/ui/toast.svelte', () => ({ toast: { success: m.success, error: m.error } }));

const load = () => import('./tracker.svelte');

beforeEach(() => {
	vi.useFakeTimers();
	Object.values(m).forEach((f) => f.mockReset());
});
afterEach(async () => {
	(await load()).resetTracker();
	vi.useRealTimers();
});

describe('фоновое отслеживание отчётов', () => {
	it('опрашивает раз в 3 секунды и по готовности показывает тост', async () => {
		const { track, trackedCount } = await load();
		m.getReport.mockResolvedValueOnce({ id: 'j1', status: 'processing' }).mockResolvedValueOnce({ id: 'j1', status: 'completed' });
		track({ id: 'j1' }, 'Реестр');
		await vi.advanceTimersByTimeAsync(3000);
		expect(m.success).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(3000);
		expect(m.success).toHaveBeenCalledWith('Отчёт «Реестр» готов', 'Скачать можно в «Мои отчёты»');
		expect(trackedCount()).toBe(0);
	});

	it('ошибка задания — тост с текстом ошибки', async () => {
		const { track } = await load();
		m.getReport.mockResolvedValue({ id: 'j2', status: 'failed', error: 'нет данных' });
		track({ id: 'j2' }, 'Динамика');
		await vi.advanceTimersByTimeAsync(3000);
		expect(m.error).toHaveBeenCalledTimes(1);
		expect(m.error.mock.calls[0][1]).toBe('Отчёт «Динамика» не сформирован');
	});

	it('повторный track того же задания не дублирует опрос; сеть не роняет отслеживание', async () => {
		const { track, trackedCount } = await load();
		m.getReport.mockRejectedValueOnce(new Error('сеть')).mockResolvedValueOnce({ id: 'j3', status: 'completed' });
		track({ id: 'j3' }, 'А');
		track({ id: 'j3' }, 'А');
		expect(trackedCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(3000);
		await vi.advanceTimersByTimeAsync(3000);
		expect(m.success).toHaveBeenCalledTimes(1);
	});

	it('через 10 минут задание больше не отслеживается', async () => {
		const { track, trackedCount, TRACK_MAX_MS } = await load();
		m.getReport.mockResolvedValue({ id: 'j4', status: 'processing' });
		track({ id: 'j4' }, 'Б');
		await vi.advanceTimersByTimeAsync(TRACK_MAX_MS + 6000);
		expect(trackedCount()).toBe(0);
	});

	it('не больше десяти заданий: самое старое вытесняется', async () => {
		const { track, trackedCount, TRACK_MAX_JOBS } = await load();
		m.getReport.mockResolvedValue({ status: 'processing' });
		for (let i = 0; i < TRACK_MAX_JOBS + 2; i++) {
			track({ id: `x${i}` }, 'В');
			await vi.advanceTimersByTimeAsync(1);
		}
		expect(trackedCount()).toBe(TRACK_MAX_JOBS);
	});
});
