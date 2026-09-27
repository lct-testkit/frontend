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
		expect(get).toHaveBeenCalledWith('/api/users/directory', { params: { query: { ids: 'a,b' } } });
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

	it('после сетевой ошибки тот же id снова доступен для повторного запроса', async () => {
		get.mockRejectedValueOnce(new Error('сеть недоступна'));
		const { people } = await load();

		people.ensure(['a']);
		await vi.advanceTimersByTimeAsync(15);
		expect(get).toHaveBeenCalledTimes(1);
		expect(people.get('a')).toBeUndefined(); // не «не найден», просто пока неизвестно — можно повторить

		get.mockResolvedValueOnce({ data: { items: [person('a')] } });
		people.ensure(['a']);
		await vi.advanceTimersByTimeAsync(15);

		expect(get).toHaveBeenCalledTimes(2);
		expect(people.get('a')?.id).toBe('a');
	});

	it('name() отдаёт короткий id пока грузится, полное имя — после ответа', async () => {
		get.mockResolvedValue({ data: { items: [person('12345678')] } });
		const { people } = await load();

		expect(people.name('12345678')).toBe('#5678');
		await vi.advanceTimersByTimeAsync(15);

		expect(people.name('12345678')).toBe('Сотрудник 12345678');
	});
});
