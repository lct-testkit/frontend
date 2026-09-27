import { beforeEach, describe, expect, it, vi } from 'vitest';

// `EntityCache` (orgCache/contactCache/dealCache) сама не экспортирована — тестируем через
// `orgCache`. `ApiError` берём настоящий (не мок): `entityCache.svelte.ts` делает
// `e instanceof ApiError` в catch, поэтому класс должен быть тем же самым объектом.
const get = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', async () => {
	const real = await vi.importActual<typeof import('$lib/api/errors')>('$lib/api/errors');
	return {
		api: { GET: get },
		unwrap: async (request: Promise<{ data?: unknown; error?: unknown; response: Response }>) => {
			const result = await request;
			if (result.error !== undefined || !result.response.ok) {
				throw real.ApiError.fromProblem(result.response.status, result.error, result.response.headers);
			}
			return result.data;
		},
		ApiError: real.ApiError
	};
});

const load = () => import('./entityCache.svelte');
const tick = () => new Promise((r) => setTimeout(r, 0));
const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });

function organization(id: string) {
	return { id, name: `Организация ${id}`, short_name: '' };
}

beforeEach(() => {
	get.mockReset();
	vi.resetModules();
});

describe('orgCache.ensure — уже летящий id не запрашивается повторно (regression guard, C-5 story)', () => {
	// В отличие от `people.ensure` (см. `$lib/api/people.test.ts`), `EntityCache` уже верно
	// дедуплицирует in-flight запросы: `#queued` очищается в `.finally()` только после ответа,
	// а не сразу после отправки запроса. Тест фиксирует это, чтобы дедуп не сломали случайно.
	it('несколько ensure() за один и тот же id подряд, пока ответ не пришёл, — один запрос', async () => {
		let resolve!: (value: unknown) => void;
		get.mockReturnValueOnce(new Promise((r) => (resolve = r)));
		const { orgCache } = await load();

		orgCache.ensure(['org-1']);
		orgCache.ensure(['org-1']);
		orgCache.ensure(['org-1']);

		expect(get).toHaveBeenCalledTimes(1);

		resolve(ok(organization('org-1')));
		await tick();

		expect(get).toHaveBeenCalledTimes(1);
		expect(orgCache.get('org-1')?.id).toBe('org-1');
	});

	it('сетевая ошибка не кэширует «недоступно» — следующий ensure повторяет попытку', async () => {
		// `ApiError` берём из мока `$lib/api` (не через отдельный `vi.importActual` в тесте): после
		// `resetModules()` в beforeEach это не всегда тот же класс, что видит `entityCache.svelte.ts`,
		// и `instanceof` внутри её catch молча даёт `false` — ошибка кэшируется как «недоступно»
		// вместо «сеть, повторить». Через мок — гарантированно тот же класс.
		const { ApiError } = await import('$lib/api');
		// `mockImplementationOnce`, не `mockReturnValueOnce(Promise.reject(...))`: иначе отклонённый
		// промис создаётся до того, как на него подписываются (`unwrap`/`.catch` в `EntityCache`),
		// и vitest репортит его как unhandled rejection.
		get.mockImplementationOnce(() => Promise.reject(ApiError.network(new TypeError('network'))));
		const { orgCache } = await load();

		orgCache.ensure(['org-2']);
		await tick();

		expect(orgCache.get('org-2')).toBeUndefined(); // не «недоступна», просто пока неизвестно

		get.mockReturnValueOnce(Promise.resolve(ok(organization('org-2'))));
		orgCache.ensure(['org-2']);
		await tick();

		expect(get).toHaveBeenCalledTimes(2);
		expect(orgCache.get('org-2')?.id).toBe('org-2');
	});

	it('403/404 (не сеть) кэшируется как «недоступно» — не спрашивается заново', async () => {
		get.mockReturnValueOnce(Promise.resolve({ data: undefined, error: { code: 'CRM-9004' }, response: new Response(null, { status: 404 }) }));
		const { orgCache } = await load();

		orgCache.ensure(['org-3']);
		await tick();

		expect(orgCache.get('org-3')).toBeNull();

		orgCache.ensure(['org-3']);
		await tick();

		expect(get).toHaveBeenCalledTimes(1); // закэшировано как null — второй раз не спрашиваем
	});
});
