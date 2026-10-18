import { describe, expect, it } from 'vitest';
import { cursorPage } from './cursorPage';

const settled = (data: unknown[], cursor?: string, status = 200) => Promise.resolve({ data, response: new Response(null, { status, headers: cursor ? { 'X-Next-Cursor': cursor } : {} }) });

describe('cursorPage', () => {
	it('курсор берётся из заголовка X-Next-Cursor', async () => {
		expect(await cursorPage(settled([1, 2], 'abc'))).toEqual({ items: [1, 2], next_cursor: 'abc' });
	});

	it('без заголовка страница последняя', async () => {
		expect((await cursorPage(settled([1]))).next_cursor).toBeNull();
	});

	it('ошибка ответа бросается как ApiError', async () => {
		const failed = Promise.resolve({ error: { detail: 'нет доступа' }, response: new Response(null, { status: 403 }) });
		await expect(cursorPage(failed)).rejects.toMatchObject({ status: 403 });
	});
});
