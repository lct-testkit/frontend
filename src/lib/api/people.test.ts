import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Тот же приём, что features/config/imports/job.test.ts: `api.GET` подменён на мок.
const get = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ api: { GET: get } }));

const load = () => import('./people.svelte');

function person(id: string) {
	return { id, full_name: `Сотрудник ${id}`, role: 'KAM', status: 'active' };
}

beforeEach(() => {
	get.mockReset();
	vi.resetModules();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('people.ensure — дедуп параллельных запросов на директорию (/deals: одинаковые GET подряд)', () => {
	it('несколько ensure() в одном тике — один batch-запрос на объединённый список id', async () => {
		get.mockResolvedValue({ data: { items: [person('a'), person('b')] } });
		const { people } = await load();

		people.ensure(['a']);
		people.ensure(['b']);
		await vi.advanceTimersByTimeAsync(15);

		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('/api/users/directory', { params: { query: { ids: 'a,b', limit: 2 } } });
	});

	it('ensure() за тот же id, пока предыдущий запрос ещё не ответил, не шлёт второй запрос', async () => {
		let resolve!: (value: unknown) => void;
		get.mockReturnValueOnce(new Promise((r) => (resolve = r)));
		const { people } = await load();

		people.ensure(['a']);
		await vi.advanceTimersByTimeAsync(15); // таймер сработал, запрос уже ушёл, ответа ещё нет

		expect(get).toHaveBeenCalledTimes(1);

		people.ensure(['a']); // тот же id, первый запрос всё ещё летит (баг: раньше это ставило id в очередь повторно)
		await vi.advanceTimersByTimeAsync(15); // даём шанс новому таймеру сработать, если бы он был поставлен

		expect(get).toHaveBeenCalledTimes(1); // без дедупа здесь было бы 2

		resolve({ data: { items: [person('a')] } });
		await vi.advanceTimersByTimeAsync(15);
		expect(people.get('a')?.id).toBe('a');
	});

	it('после сетевой ошибки id не кэшируется как «не найден» и сам повторяется через 2 с', async () => {
		get.mockRejectedValueOnce(new Error('сеть недоступна'));
		const { people } = await load();

		people.ensure(['a']);
		await vi.advanceTimersByTimeAsync(15);
		expect(get).toHaveBeenCalledTimes(1);
		expect(people.get('a')).toBeUndefined(); // не «не найден», просто пока неизвестно
		expect(people.name('a')).toBe('…');

		get.mockResolvedValueOnce({ data: { items: [person('a')] } });
		await vi.advanceTimersByTimeAsync(2000);

		expect(get).toHaveBeenCalledTimes(2);
		expect(people.name('a')).toBe('Сотрудник a');
	});

	it('ответ с ошибкой (openapi-fetch не бросает на 429/5xx, а отдаёт error) не превращает всех в «не найден»', async () => {
		get.mockResolvedValueOnce({ data: undefined, error: { status: 429 } });
		const { people } = await load();

		people.ensure(['a', 'b']);
		await vi.advanceTimersByTimeAsync(15);
		expect(people.get('a')).toBeUndefined();
		expect(people.get('b')).toBeUndefined();
		expect(people.name('a')).toBe('…'); // а не «Пользователь недоступен»

		get.mockResolvedValueOnce({ data: { items: [person('a'), person('b')] } });
		await vi.advanceTimersByTimeAsync(2000);
		expect(people.name('a')).toBe('Сотрудник a');
		expect(people.name('b')).toBe('Сотрудник b');
	});

	it('после четырёх неудач подряд name() показывает запасной текст, а не вечное «…»', async () => {
		get.mockResolvedValue({ data: undefined, error: { status: 500 } });
		const { people } = await load();

		people.ensure(['a']);
		await vi.advanceTimersByTimeAsync(15 + 2000 + 4000 + 8000);
		expect(get).toHaveBeenCalledTimes(4);
		expect(people.name('a')).toBe('—');
		expect(people.name('a', 'Система')).toBe('Система');
		await vi.advanceTimersByTimeAsync(60_000);
		expect(get).toHaveBeenCalledTimes(4); // дальше не долбим
	});

	it('больше 100 id режутся на пакеты по 100 и каждый просит limit по своему размеру (по умолчанию ручка отдаёт 50)', async () => {
		get.mockImplementation(async (_url: string, opts: { params: { query: { ids: string } } }) => ({
			data: { items: opts.params.query.ids.split(',').map(person) }
		}));
		const { people } = await load();

		people.ensure(Array.from({ length: 130 }, (_, i) => `u${i}`));
		await vi.advanceTimersByTimeAsync(15 + 15);

		expect(get).toHaveBeenCalledTimes(2);
		expect(get.mock.calls[0][1].params.query.limit).toBe(100);
		expect(get.mock.calls[1][1].params.query.limit).toBe(30);
		expect(people.name('u129')).toBe('Сотрудник u129');
		expect(people.name('u0')).toBe('Сотрудник u0');
	});

	it('пустые и кривые id в пакет не попадают (иначе 422 на весь пакет)', async () => {
		get.mockResolvedValue({ data: { items: [person('a')] } });
		const { people } = await load();

		people.ensure(['', '  ', 'x,y', 'a', null, undefined]);
		await vi.advanceTimersByTimeAsync(15);

		expect(get).toHaveBeenCalledTimes(1);
		expect(get.mock.calls[0][1].params.query).toEqual({ ids: 'a', limit: 1 });
	});

	it('name() отдаёт многоточие пока грузится, полное имя — после ответа', async () => {
		get.mockResolvedValue({ data: { items: [person('12345678')] } });
		const { people } = await load();

		expect(people.name('12345678')).toBe('…');
		await vi.advanceTimersByTimeAsync(15);

		expect(people.name('12345678')).toBe('Сотрудник 12345678');
	});

	it('name() для id, которого нет в справочнике, — «Пользователь недоступен», а не хэш', async () => {
		get.mockResolvedValue({ data: { items: [] } });
		const { people } = await load();
		people.name('ghost-0001');
		await vi.advanceTimersByTimeAsync(15);
		expect(people.name('ghost-0001')).toBe('Пользователь недоступен');
	});
});
