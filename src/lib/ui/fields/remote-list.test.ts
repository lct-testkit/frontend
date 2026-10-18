import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteList, type RemoteItem, type RemotePage } from './remote-list.svelte';

const item = (key: string, value = key): RemoteItem => ({ key, value });
const page = (keys: string[], next: string | null = null): RemotePage => ({ items: keys.map((k) => item(k)), next });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RemoteList', () => {
	it('быстрый ввод даёт один запрос с последним текстом через 250 мс', async () => {
		const search = vi.fn().mockResolvedValue(page(['a']));
		const list = new RemoteList(search);
		list.setQuery('Т');
		list.setQuery('Том');
		await vi.advanceTimersByTimeAsync(249);
		expect(search).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(2);
		expect(search).toHaveBeenCalledTimes(1);
		expect(search).toHaveBeenCalledWith('Том', null);
		expect(list.items.map((i) => i.key)).toEqual(['a']);
	});

	it('ответ устаревшего запроса не затирает новый', async () => {
		let resolveFirst!: (p: RemotePage) => void;
		const search = vi
			.fn()
			.mockImplementationOnce(() => new Promise<RemotePage>((r) => (resolveFirst = r)))
			.mockResolvedValueOnce(page(['second']));
		const list = new RemoteList(search);
		list.setQuery('а');
		await vi.advanceTimersByTimeAsync(250);
		list.setQuery('аб');
		await vi.advanceTimersByTimeAsync(250);
		resolveFirst(page(['first']));
		await vi.advanceTimersByTimeAsync(0);
		expect(list.items.map((i) => i.key)).toEqual(['second']);
		expect(list.loading).toBe(false);
	});

	it('loadMore дописывает страницу по курсору, убирает повторы и гасит hasMore на последней', async () => {
		const search = vi.fn().mockResolvedValueOnce(page(['a', 'b'], 'c1')).mockResolvedValueOnce(page(['b', 'c'], null));
		const list = new RemoteList(search);
		list.ensureLoaded();
		await vi.advanceTimersByTimeAsync(0);
		expect(list.hasMore).toBe(true);
		await list.loadMore();
		expect(search).toHaveBeenLastCalledWith('', 'c1');
		expect(list.items.map((i) => i.key)).toEqual(['a', 'b', 'c']);
		expect(list.hasMore).toBe(false);
		await list.loadMore();
		expect(search).toHaveBeenCalledTimes(2);
	});

	it('новый запрос сбрасывает курсор, а known хранит элементы прошлой выдачи', async () => {
		const search = vi.fn().mockResolvedValueOnce(page(['a'], 'c1')).mockResolvedValueOnce(page(['z']));
		const list = new RemoteList(search);
		list.ensureLoaded();
		await vi.advanceTimersByTimeAsync(0);
		list.setQuery('я');
		await vi.advanceTimersByTimeAsync(250);
		expect(search).toHaveBeenLastCalledWith('я', null);
		expect(list.items.map((i) => i.key)).toEqual(['z']);
		expect([...list.known.keys()].sort()).toEqual(['a', 'z']);
	});

	it('ensureLoaded уходит в сеть один раз', async () => {
		const search = vi.fn().mockResolvedValue(page(['a']));
		const list = new RemoteList(search);
		list.ensureLoaded();
		list.ensureLoaded();
		await vi.advanceTimersByTimeAsync(0);
		list.ensureLoaded();
		expect(search).toHaveBeenCalledTimes(1);
	});

	it('ошибка поиска попадает в error, retry снимает её при успехе', async () => {
		const search = vi.fn().mockRejectedValueOnce(new Error('сеть')).mockResolvedValueOnce(page(['a']));
		const list = new RemoteList(search);
		list.ensureLoaded();
		await vi.advanceTimersByTimeAsync(0);
		expect(list.error).toBeInstanceOf(Error);
		expect(list.items).toEqual([]);
		await list.retry();
		expect(list.error).toBeNull();
		expect(list.items.map((i) => i.key)).toEqual(['a']);
	});

	it('ошибка подгрузки оставляет уже показанное; retry повторяет подгрузку, а не первую страницу', async () => {
		const search = vi.fn().mockResolvedValueOnce(page(['a'], 'c1')).mockRejectedValueOnce(new Error('сеть')).mockResolvedValueOnce(page(['b']));
		const list = new RemoteList(search);
		list.ensureLoaded();
		await vi.advanceTimersByTimeAsync(0);
		await list.loadMore();
		expect(list.error).not.toBeNull();
		expect(list.items.map((i) => i.key)).toEqual(['a']);
		await list.retry();
		expect(search).toHaveBeenLastCalledWith('', 'c1');
		expect(list.items.map((i) => i.key)).toEqual(['a', 'b']);
	});

	it('remember добавляет подписи в словарь', () => {
		const list = new RemoteList(vi.fn());
		list.remember([item('x', 'Икс')]);
		expect(list.known.get('x')?.value).toBe('Икс');
	});
});
