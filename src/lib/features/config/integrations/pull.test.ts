import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PullRun, phaseOf, POLL_TIMEOUT, type PullDeps } from './pull.svelte';

const T0 = Date.parse('2026-10-18T10:00:00Z');
const run = { trigger: 'manual', finished_at: '2026-10-18T10:00:30Z', fetched: 3, created: 3, failed: 0, error: null };
const queued = { pull_request: { requested_at: '2026-10-18T10:00:00Z' }, last_run: null };
const running = { pull_request: null, last_run: { finished_at: '2026-10-18T09:00:00Z', fetched: 1 } };
const finished = { pull_request: null, last_run: run };

let clock = T0;
const deps = (statuses: unknown[], start?: PullDeps['start']): PullDeps => {
	let i = 0;
	return {
		start: start ?? (async () => ({ requested_at: '2026-10-18T10:00:00Z' })),
		status: async () => statuses[Math.min(i++, statuses.length - 1)] as never,
		now: () => clock
	};
};

beforeEach(() => {
	vi.useFakeTimers();
	clock = T0;
});
afterEach(() => vi.useRealTimers());

describe('phaseOf', () => {
	it('в очереди, идёт (итог старее запроса), готово', () => {
		expect(phaseOf(queued, T0).phase).toBe('queued');
		expect(phaseOf(running, T0).phase).toBe('running');
		expect(phaseOf(finished, T0).phase).toBe('done');
	});
});

describe('PullRun', () => {
	it('202, затем в очереди, идёт, готово: состояние done и один вызов перезагрузки', async () => {
		const onDone = vi.fn();
		const p = new PullRun(onDone, deps([queued, running, finished]));
		await p.start('cms');
		await vi.advanceTimersByTimeAsync(0);
		expect(p.phase).toBe('queued');
		await vi.advanceTimersByTimeAsync(2000);
		expect(p.phase).toBe('running');
		await vi.advanceTimersByTimeAsync(2000);
		expect(p.phase).toBe('done');
		expect(p.run).toMatchObject({ fetched: 3 });
		expect(onDone).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it('409 при запуске: failed с кодом и текстом, опроса нет', async () => {
		const p = new PullRun(vi.fn(), deps([], async () => Promise.reject(Object.assign(new Error('Источник отключён'), { code: 'CRM-1703' }))));
		await p.start('cms');
		expect(p.phase).toBe('failed');
		expect(p.errorCode).toBe('CRM-1703');
		expect(p.error).toBeTruthy();
	});

	it('запуск завершился ошибкой: failed с текстом из итога, карточка всё равно перечитана', async () => {
		const onDone = vi.fn();
		const p = new PullRun(onDone, deps([{ pull_request: null, last_run: { ...run, error: 'Сайт не ответил' } }]));
		await p.start('cms');
		await vi.advanceTimersByTimeAsync(0);
		expect(p.phase).toBe('failed');
		expect(p.error).toBe('Сайт не ответил');
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it('дольше 120 секунд — timeout', async () => {
		const p = new PullRun(vi.fn(), deps([queued]));
		await p.start('cms');
		await vi.advanceTimersByTimeAsync(0);
		clock = T0 + POLL_TIMEOUT + 1;
		await vi.advanceTimersByTimeAsync(2000);
		expect(p.phase).toBe('timeout');
	});

	it('пока запуск идёт, повторный start игнорируется', async () => {
		const start = vi.fn(async () => ({ requested_at: '2026-10-18T10:00:00Z' }));
		const p = new PullRun(vi.fn(), deps([queued], start));
		await p.start('cms');
		await p.start('cms');
		expect(start).toHaveBeenCalledTimes(1);
		p.stop();
	});
});
