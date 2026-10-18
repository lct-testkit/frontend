import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/errors';

const post = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', async () => {
	const unwrap = async (p: Promise<{ data?: unknown; error?: unknown }>) => {
		const r = await p;
		if (r.error) throw r.error;
		return r.data;
	};
	return { api: { POST: post }, idem: (k: string) => ({ 'Idempotency-Key': k }), unwrap };
});

const { linkAttachment, isStillScanning, LINK_ATTEMPTS } = await import('./link');
const params = { fileId: 'f1', entityType: 'deal', entityId: 'd1', category: 'contract' as const, description: 'a.pdf' };
const scanning = () => ({ error: new ApiError({ status: 422, detail: 'Файл ещё не прошёл проверку' }) });
const keyOf = (call: unknown[]) => (call[1] as { headers: Record<string, string> }).headers['Idempotency-Key'];

beforeEach(() => {
	post.mockReset();
});

describe('linkAttachment', () => {
	it('файл ещё на проверке (422): повторяет, пока не привяжется; ключ идемпотентности один на всю цепочку', async () => {
		post.mockResolvedValueOnce(scanning()).mockResolvedValueOnce(scanning()).mockResolvedValueOnce({ data: { id: 'att1' } });
		const res = await linkAttachment(params, 0);
		expect(res).toEqual({ id: 'att1' });
		expect(post).toHaveBeenCalledTimes(3);
		expect(new Set(post.mock.calls.map(keyOf)).size).toBe(1);
	});
	it('сдаётся после шести попыток и отдаёт последнюю ошибку', async () => {
		post.mockResolvedValue(scanning());
		await expect(linkAttachment(params, 0)).rejects.toMatchObject({ status: 422 });
		expect(post).toHaveBeenCalledTimes(LINK_ATTEMPTS);
	});
	it('другая ошибка не повторяется', async () => {
		post.mockResolvedValue({ error: new ApiError({ status: 403, detail: 'нет прав' }) });
		await expect(linkAttachment(params, 0)).rejects.toMatchObject({ status: 403 });
		expect(post).toHaveBeenCalledTimes(1);
	});
	it('isStillScanning узнаёт только 422 с «не прошёл проверку»', () => {
		expect(isStillScanning(new ApiError({ status: 422, detail: 'Файл не прошёл проверку' }))).toBe(true);
		expect(isStillScanning(new ApiError({ status: 422, detail: 'Другое' }))).toBe(false);
		expect(isStillScanning(new ApiError({ status: 500, detail: 'не прошёл проверку' }))).toBe(false);
		expect(isStillScanning(new Error('не прошёл проверку'))).toBe(false);
	});
});
