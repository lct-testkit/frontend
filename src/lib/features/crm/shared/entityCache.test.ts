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

describe('dealCache — удалённая сделка (404) не запрашивается повторно, в том числе после «перезагрузки страницы»', () => {
	const problem404 = () => Promise.resolve({ data: undefined, error: { code: 'CRM-9004' }, response: new Response(null, { status: 404 }) });

	function stubSessionStorage() {
		const store = new Map<string, string>();
		vi.stubGlobal('sessionStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v),
			removeItem: (k: string) => void store.delete(k)
		});
		return store;
	}

	it('404 запоминается: второй ensure не шлёт запрос, подпись — «Сделка удалена»', async () => {
		stubSessionStorage();
		get.mockReturnValueOnce(problem404());
		const { dealCache, dealLabel } = await load();

		dealCache.ensure(['deal-gone']);
		await tick();
		dealCache.ensure(['deal-gone']);
		await tick();

		expect(get).toHaveBeenCalledTimes(1);
		expect(dealLabel('deal-gone')).toBe('Сделка удалена');
	});

	it('после перезагрузки страницы (модули загружены заново, sessionStorage тот же) запроса нет совсем', async () => {
		stubSessionStorage();
		get.mockReturnValueOnce(problem404());
		const first = await load();
		first.dealCache.ensure(['deal-gone-2']);
		await tick();
		expect(get).toHaveBeenCalledTimes(1);

		vi.resetModules();
		const second = await load();
		second.dealCache.ensure(['deal-gone-2']);
		await tick();

		expect(get).toHaveBeenCalledTimes(1);
		expect(second.dealLabel('deal-gone-2')).toBe('Сделка удалена');
	});

	it('429 и 5xx не превращаются в «удалена»: сделка остаётся неизвестной и не запрашивается чаще, чем раз в 15 с', async () => {
		stubSessionStorage();
		vi.useFakeTimers();
		try {
			get.mockReturnValueOnce(Promise.resolve({ data: undefined, error: { code: 'CRM-8429' }, response: new Response(null, { status: 429 }) }));
			const { dealCache, dealLabel } = await load();

			dealCache.ensure(['deal-busy']);
			await vi.advanceTimersByTimeAsync(0);
			expect(dealCache.get('deal-busy')).toBeUndefined();
			expect(dealLabel('deal-busy')).toBe('…');

			dealCache.ensure(['deal-busy']);
			await vi.advanceTimersByTimeAsync(0);
			expect(get).toHaveBeenCalledTimes(1); // слишком рано

			await vi.advanceTimersByTimeAsync(16_000);
			get.mockReturnValueOnce(Promise.resolve(ok({ deal: { id: 'deal-busy', number: 'D-1', title: 'Школа' } })));
			dealCache.ensure(['deal-busy']);
			await vi.advanceTimersByTimeAsync(0);
			expect(get).toHaveBeenCalledTimes(2);
			expect(dealLabel('deal-busy')).toBe('D-1 · Школа');
		} finally {
			vi.useRealTimers();
		}
	});

	it('403 — «недоступна», а не «удалена», и в sessionStorage не пишется', async () => {
		const store = stubSessionStorage();
		get.mockReturnValueOnce(Promise.resolve({ data: undefined, error: { code: 'CRM-1102' }, response: new Response(null, { status: 403 }) }));
		const { dealCache, dealLabel } = await load();

		dealCache.ensure(['deal-denied']);
		await tick();

		expect(dealLabel('deal-denied')).toBe('Сделка недоступна');
		expect(store.size).toBe(0);
	});

	it('preloadDeals: список прочитан до конца — сделки, которых в нём нет, помечаются удалёнными без запроса GET /deals/{id}', async () => {
		stubSessionStorage();
		get.mockReturnValueOnce(Promise.resolve(ok({ items: [{ id: 'live', number: 'D-2', title: 'Живая' }], next_cursor: null })));
		const { dealCache, dealLabel, preloadDeals } = await load();

		await preloadDeals(['live', 'deleted-1', 'deleted-2']);

		expect(get).toHaveBeenCalledTimes(1);
		expect(get.mock.calls[0][0]).toBe('/api/deals');
		expect(dealLabel('live')).toBe('D-2 · Живая');
		expect(dealCache.get('deleted-1')).toBeNull();
		expect(dealLabel('deleted-2')).toBe('Сделка удалена');
	});

	it('preloadDeals: список длиннее 5 страниц — остаток спрашивается по одному', async () => {
		stubSessionStorage();
		for (let i = 0; i < 5; i += 1) get.mockReturnValueOnce(Promise.resolve(ok({ items: [], next_cursor: `c${i}` })));
		get.mockReturnValueOnce(Promise.resolve(ok({ deal: { id: 'far', number: 'D-9', title: 'Далёкая' } })));
		const { dealLabel, preloadDeals } = await load();

		await preloadDeals(['far']);
		await tick();

		expect(get).toHaveBeenCalledTimes(6);
		expect(get.mock.calls[5][0]).toBe('/api/deals/{deal_id}');
		expect(dealLabel('far')).toBe('D-9 · Далёкая');
	});
});
