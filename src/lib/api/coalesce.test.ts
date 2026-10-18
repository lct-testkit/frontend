import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coalesce, forget } from './coalesce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('coalesce', () => {
	it('два вызова подряд — один запрос', async () => {
		const fetcher = vi.fn().mockResolvedValue(1);
		const [a, b] = await Promise.all([coalesce('k1', fetcher), coalesce('k1', fetcher)]);
		expect([a, b, fetcher.mock.calls.length]).toEqual([1, 1, 1]);
	});

	it('после ttl — новый запрос', async () => {
		const fetcher = vi.fn().mockResolvedValue(1);
		await coalesce('k2', fetcher, 100);
		vi.advanceTimersByTime(101);
		await coalesce('k2', fetcher, 100);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('ошибка не кэшируется', async () => {
		const fetcher = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(2);
		await expect(coalesce('k3', fetcher)).rejects.toThrow('x');
		await expect(coalesce('k3', fetcher)).resolves.toBe(2);
	});

	it('forget сбрасывает', async () => {
		const fetcher = vi.fn().mockResolvedValue(1);
		await coalesce('k4', fetcher);
		forget('k4');
		await coalesce('k4', fetcher);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
