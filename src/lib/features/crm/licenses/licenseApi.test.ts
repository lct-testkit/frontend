import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api';
import { resolveLicense } from './licenseApi';
import { makeLicenses } from './testing';

describe('resolveLicense', () => {
	const items = makeLicenses();

	it('запись есть в списке — без обращения к сети', async () => {
		const fetcher = vi.fn();
		expect(await resolveLicense(items, 'l-2026', fetcher)).toBe(items[1]);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('записи нет в списке — запрос по id', async () => {
		const far = { ...items[0], id: 'far' };
		const fetcher = vi.fn().mockResolvedValue(far);
		expect(await resolveLicense(items, 'far', fetcher)).toBe(far);
		expect(fetcher).toHaveBeenCalledWith('far');
	});

	it('чужая или удалённая (запрос вернул null) — null', async () => {
		expect(await resolveLicense(items, 'x', async () => null)).toBeNull();
	});

	it('другие ошибки пробрасываются', async () => {
		const boom = new ApiError({ status: 500, detail: 'сбой' });
		await expect(resolveLicense(items, 'x', async () => Promise.reject(boom))).rejects.toBe(boom);
	});
});
