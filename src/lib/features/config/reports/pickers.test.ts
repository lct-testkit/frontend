import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({
	api: { GET: get },
	unwrap: async (request: Promise<{ data?: unknown }>) => (await request).data
}));

const load = () => import('./pickers');
const ok = (data: unknown) => Promise.resolve({ data });

beforeEach(() => get.mockReset());

describe('вузы', () => {
	it('поиск передаёт q, limit 20 и курсор; подпись — короткое название, подсказка — ИНН', async () => {
		get.mockReturnValue(ok({ items: [{ id: 'o1', name: 'Полное название', short_name: 'МГТУ', inn: '123' }, { id: 'o2', name: 'Без короткого', short_name: null, inn: null }], next_cursor: 'c2' }));
		const { orgSearch } = await load();
		const page = await orgSearch('Том', 'c1');
		expect(get).toHaveBeenCalledWith('/api/organizations', { params: { query: { q: 'Том', limit: 20, cursor: 'c1' } } });
		expect(page).toEqual({
			items: [
				{ key: 'o1', value: 'МГТУ', hint: '123' },
				{ key: 'o2', value: 'Без короткого', hint: undefined }
			],
			next: 'c2'
		});
	});

	it('пустой запрос не уходит параметром q; первая страница — без курсора', async () => {
		get.mockReturnValue(ok({ items: [], next_cursor: null }));
		const { orgSearch } = await load();
		const page = await orgSearch('', null);
		expect(get).toHaveBeenCalledWith('/api/organizations', { params: { query: { q: undefined, limit: 20, cursor: undefined } } });
		expect(page.next).toBeNull();
	});

	it('разрешение подписей пропускает недоступные организации', async () => {
		get.mockImplementation((_url: string, opts: { params: { path: { organization_id: string } } }) => {
			
			const id = opts?.params?.path?.organization_id as string;
			return id === 'gone' ? Promise.reject(new Error('404')) : ok({ id, name: 'Вуз', short_name: null, inn: null });
		});
		const { orgResolve } = await load();
		expect(await orgResolve(['a', 'gone'])).toEqual([{ key: 'a', value: 'Вуз', hint: undefined }]);
	});
});

describe('сотрудники', () => {
	it('поиск всегда с limit 100 и без следующей страницы', async () => {
		get.mockReturnValue(ok({ items: [{ id: 'u1', full_name: 'Иванов И. И.', display_name: null }, { id: 'u2', full_name: 'Петров', display_name: 'Пётр П.' }] }));
		const { ownerSearch } = await load();
		const page = await ownerSearch('', null);
		expect(get).toHaveBeenCalledWith('/api/users/directory', { params: { query: { q: undefined, limit: 100 } } });
		expect(page.next).toBeNull();
		expect(page.items.map((i) => i.value)).toEqual(['Иванов И. И.', 'Пётр П.']);
	});

	it('разрешение — одним запросом по ids', async () => {
		get.mockReturnValue(ok({ items: [{ id: 'u1', full_name: 'Иванов', display_name: null }] }));
		const { ownerResolve } = await load();
		await ownerResolve(['u1', 'u2']);
		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('/api/users/directory', { params: { query: { ids: 'u1,u2' } } });
	});
});

describe('продукты и направления', () => {
	it('продукты: архивные не отфильтровываются, подсказка — вендор и код, в элемент кладётся direction_id', async () => {
		get.mockReturnValue(ok({ items: [{ id: 'p1', name: 'Курс', code: 'c1', vendor_name: 'Вендор', direction_id: 'd1' }], next_cursor: null }));
		const { productSearch } = await load();
		const page = await productSearch('к', null);
		expect(get.mock.calls[0][1].params.query).not.toHaveProperty('is_active');
		expect(page.items[0]).toMatchObject({ key: 'p1', value: 'Курс', hint: 'Вендор · c1', direction_id: 'd1' });
	});

	it('сохранённые id ищутся постранично, пока не найдены все', async () => {
		get
			.mockReturnValueOnce(ok({ items: [{ id: 'd1', name: 'Первое' }], next_cursor: 'c2' }))
			.mockReturnValueOnce(ok({ items: [{ id: 'd2', name: 'Второе' }], next_cursor: 'c3' }));
		const { directionResolve } = await load();
		const found = await directionResolve(['d1', 'd2']);
		expect(found.map((i) => i.value)).toEqual(['Первое', 'Второе']);
		expect(get).toHaveBeenCalledTimes(2); // третью страницу не просим: всё найдено
	});
});
