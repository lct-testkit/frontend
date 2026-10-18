import { ApiError } from '$lib/api';
import type { Page } from '$lib/api/pager.svelte';

/** Размер страницы журналов: больше 50 строк подгружаются кнопкой «Показать ещё». */
export const PAGE_SIZE = 50;

interface Settled<T> {
	data?: T[];
	error?: unknown;
	response: Response;
}

/** Ручки журналов отдают массив, а курсор следующей страницы кладут в заголовок `X-Next-Cursor`. */
export async function cursorPage<T>(request: Promise<Settled<T>>): Promise<Page<T>> {
	const { data, error, response } = await request;
	if (error !== undefined || !response.ok) throw ApiError.fromProblem(response.status, error, response.headers);
	return { items: data ?? [], next_cursor: response.headers.get('X-Next-Cursor') };
}
