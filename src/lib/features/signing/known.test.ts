import { beforeEach, describe, expect, it, vi } from 'vitest';

// Тот же приём, что job.test.ts (features/config/imports): `api.GET` подменён на мок, `unwrap`
// разворачивает `{ data }` и бросает `{ error }` — как настоящий `unwrap` из `$lib/api/client.ts`.
const get = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({
	api: { GET: get },
	unwrap: async (request: Promise<{ data?: unknown; error?: unknown }>) => {
		const response = await request;
		if (response.error) throw new Error(String(response.error));
		return response.data;
	}
}));

const load = () => import('./known');

type Query = { params: { query: { ids: string } } };
const idsOf = (call: unknown[]) => (call[1] as Query).params.query.ids.split(',');
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- минимальная карточка документа для теста
const doc = (id: string): any => ({ id, title: `Документ ${id}` });

/** `localStorage` в среде тестов (vitest `environment: 'node'`) нет — простая замена в памяти. */
function memoryStorage(): Storage {
	const store = new Map<string, string>();
	return {
		getItem: (key) => store.get(key) ?? null,
		setItem: (key, value) => void store.set(key, value),
		removeItem: (key) => void store.delete(key),
		clear: () => void store.clear(),
		key: (index) => [...store.keys()][index] ?? null,
		get length() {
			return store.size;
		}
	} as Storage;
}

beforeEach(() => {
	get.mockReset();
	vi.resetModules();
	vi.unstubAllGlobals();
	vi.stubGlobal('localStorage', memoryStorage());
});

describe('fetchDocuments — batch вместо N одиночных GET (C-5)', () => {
	it('несколько id — один запрос на пачку, не по одному', async () => {
		get.mockResolvedValue({ data: { items: [doc('a'), doc('b')] } });
		const { fetchDocuments } = await load();

		const docs = await fetchDocuments(['a', 'b']);

		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('/api/signature-documents/batch', {
			params: { query: { ids: 'a,b' } }
		});
		expect(docs.map((d) => d.id)).toEqual(['a', 'b']);
	});

	it('повторяющиеся id схлопываются перед запросом', async () => {
		get.mockResolvedValue({ data: { items: [doc('a')] } });
		const { fetchDocuments } = await load();

		const docs = await fetchDocuments(['a', 'a', 'a']);

		expect(get).toHaveBeenCalledTimes(1);
		expect(idsOf(get.mock.calls[0])).toEqual(['a']);
		expect(docs).toHaveLength(1);
	});

	it('недоступный или не найденный id просто отсутствует в ответе — не ошибка', async () => {
		// бэкенд тихо не включает 'missing' в items (403/404 на этот id), запрос в целом успешен
		get.mockResolvedValue({ data: { items: [doc('a')] } });
		const { fetchDocuments } = await load();

		const docs = await fetchDocuments(['a', 'missing']);

		expect(docs.map((d) => d.id)).toEqual(['a']);
	});

	it('больше лимита в одном запросе — режется на группы по 100', async () => {
		get.mockImplementation(async (_path: string, opts: Query) => ({
			data: { items: opts.params.query.ids.split(',').map(doc) }
		}));
		const { fetchDocuments } = await load();
		const many = Array.from({ length: 150 }, (_, i) => `id-${i}`);

		const docs = await fetchDocuments(many, 2);

		expect(get).toHaveBeenCalledTimes(2);
		expect(idsOf(get.mock.calls[0])).toHaveLength(100);
		expect(idsOf(get.mock.calls[1])).toHaveLength(50);
		expect(docs).toHaveLength(150);
	});

	it('уже закэшированный документ повторно не запрашивается', async () => {
		get.mockResolvedValue({ data: { items: [doc('a')] } });
		const { fetchDocuments, cachedDocument } = await load();
		await fetchDocuments(['a']);
		expect(cachedDocument('a')?.id).toBe('a');
		get.mockClear();

		const docs = await fetchDocuments(['a']);

		expect(get).not.toHaveBeenCalled();
		expect(docs.map((d) => d.id)).toEqual(['a']);
	});

	it('параллельные fetchDocument и fetchDocuments за один id — один сетевой запрос', async () => {
		let resolve!: (value: { data: unknown }) => void;
		get.mockReturnValueOnce(new Promise((r) => (resolve = r)));
		const { fetchDocument, fetchDocuments } = await load();

		const single = fetchDocument('shared');
		const batch = fetchDocuments(['shared']);
		resolve({ data: doc('shared') }); // одиночный GET отдаёт карточку напрямую, не {items: […]}
		const [singleResult, batchResult] = await Promise.all([single, batch]);

		expect(get).toHaveBeenCalledTimes(1);
		expect(singleResult?.id).toBe('shared');
		expect(batchResult.map((d) => d.id)).toEqual(['shared']);
	});

	it('сбой сети — пустой результат, а не брошенная ошибка', async () => {
		get.mockResolvedValue({ error: 'сеть недоступна' });
		const { fetchDocuments } = await load();

		await expect(fetchDocuments(['a'])).resolves.toEqual([]);
	});

	it('сбой одной группы не мешает получить документы из другой', async () => {
		get.mockImplementation(async (_path: string, opts: Query) => {
			const ids = opts.params.query.ids.split(',');
			if (ids[0] === 'id-0') throw new Error('сеть недоступна');
			return { data: { items: ids.map(doc) } };
		});
		const { fetchDocuments } = await load();
		const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`); // 100 (сгорит) + 1 (пройдёт)

		const docs = await fetchDocuments(ids, 2);

		expect(get).toHaveBeenCalledTimes(2);
		expect(docs.map((d) => d.id)).toEqual(['id-100']);
	});
});

describe('rememberDocument / knownDocumentIds — что создавали в этом браузере', () => {
	it('запомненный документ находится по своему id и по entity_id сделки', async () => {
		const { rememberDocument, knownDocumentIds } = await load();
		rememberDocument('doc-1', 'deal-1');
		rememberDocument('doc-2', 'deal-2');

		expect(knownDocumentIds()).toEqual(['doc-2', 'doc-1']);
		expect(knownDocumentIds('deal-1')).toEqual(['doc-1']);
		expect(knownDocumentIds('deal-2')).toEqual(['doc-2']);
	});

	it('повторное запоминание того же id поднимает его наверх, а не дублирует', async () => {
		const { rememberDocument, knownDocumentIds } = await load();
		rememberDocument('doc-1', 'deal-1');
		rememberDocument('doc-2', 'deal-2');
		rememberDocument('doc-1', 'deal-1');

		expect(knownDocumentIds()).toEqual(['doc-1', 'doc-2']);
	});

	it('без доступа к localStorage — тихо ничего не помнит, не бросает', async () => {
		vi.stubGlobal('localStorage', undefined);
		const { rememberDocument, knownDocumentIds } = await load();

		expect(() => rememberDocument('doc-1', null)).not.toThrow();
		expect(knownDocumentIds()).toEqual([]);
	});
});

describe('putDocument / cachedDocument — заполнение кэша извне (например, сразу после создания)', () => {
	it('положенный документ виден через cachedDocument и не запрашивается повторно', async () => {
		const { putDocument, cachedDocument, fetchDocuments } = await load();
		putDocument(doc('x'));

		expect(cachedDocument('x')?.id).toBe('x');
		const docs = await fetchDocuments(['x']);

		expect(get).not.toHaveBeenCalled();
		expect(docs.map((d) => d.id)).toEqual(['x']);
	});
});
