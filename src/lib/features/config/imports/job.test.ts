import { beforeEach, describe, expect, it, vi } from 'vitest';

// Клиент API подменён: `GET` отдаёт заранее заданный ответ, `unwrap` разворачивает `{ data }` и бросает `{ error }`.
const get = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({
	api: { GET: get },
	unwrap: async (request: Promise<{ data?: unknown; error?: unknown }>) => {
		const response = await request;
		if (response.error) throw new Error(String(response.error));
		return response.data;
	}
}));

const load = () => import('./job');

beforeEach(() => {
	get.mockReset();
	vi.resetModules();
	vi.unstubAllGlobals();
});

describe('подписи и статусы', () => {
	it('статус задания: подпись, тон и шаг; неизвестный — как есть', async () => {
		const { jobStatus } = await load();
		expect(jobStatus('completed')).toMatchObject({ label: 'Завершён', tone: 'success', step: 4 });
		expect(jobStatus('что-то новое')).toEqual({ label: 'что-то новое', tone: 'neutral', step: 0 });
	});

	it('тип и режим — короткая подпись, неизвестные — код', async () => {
		const { entityLabel, modeLabel } = await load();
		expect(entityLabel('vendor_contact')).toBe('Вендоры');
		expect(entityLabel('invoice')).toBe('invoice');
		expect(modeLabel('insert')).toBe('Только создать');
		expect(modeLabel('merge')).toBe('merge');
	});

	it('незавершённое задание — то, которое можно продолжить в мастере', async () => {
		const { isDraftJob } = await load();
		for (const status of ['uploaded', 'mapped', 'validated']) expect(isDraftJob({ status })).toBe(true);
		for (const status of ['applying', 'completed', 'failed']) expect(isDraftJob({ status })).toBe(false);
	});
});

describe('куда вести из результата', () => {
	it('у каждого типа свой раздел и подпись кнопки', async () => {
		const { resultHref, resultLabel } = await load();
		expect(resultHref('payment')).toBe('/deals');
		expect(resultLabel('payment')).toBe('сделки');
		expect(resultHref('learner')).toBe('/contacts');
		expect(resultHref('vendor_contact')).toBe('/contacts');
		expect(resultHref('product')).toBe('/catalog/products');
		expect(resultHref('organization')).toBe('/organizations');
	});

	it('неизвестный тип — организации, подпись из названия типа', async () => {
		const { resultHref, resultLabel } = await load();
		expect(resultHref('invoice')).toBe('/organizations');
		expect(resultLabel('invoice')).toBe('invoice');
	});
});

describe('типы сущностей с сервера', () => {
	it('запрашиваются один раз на все вызовы', async () => {
		get.mockResolvedValue({ data: { items: [{ code: 'payment' }] } });
		const { loadEntityTypes } = await load();

		const [first, second] = await Promise.all([loadEntityTypes(), loadEntityTypes()]);

		expect(first).toEqual([{ code: 'payment' }]);
		expect(second).toBe(first);
		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('/api/imports/entity-types');
	});

	it('после ошибки следующий вызов пробует снова', async () => {
		get.mockResolvedValueOnce({ error: 'сеть' }).mockResolvedValueOnce({ data: { items: [{ code: 'learner' }] } });
		const { loadEntityTypes } = await load();

		await expect(loadEntityTypes()).rejects.toThrow('сеть');
		await expect(loadEntityTypes()).resolves.toEqual([{ code: 'learner' }]);
		expect(get).toHaveBeenCalledTimes(2);
	});
});

describe('отчёт об ошибках', () => {
	it('без файла ничего не открывает и не запрашивает', async () => {
		const open = vi.fn();
		vi.stubGlobal('window', { open });
		const { openErrorReport } = await load();

		await openErrorReport({ id: 'j1', result_file_id: null });

		expect(get).not.toHaveBeenCalled();
		expect(open).not.toHaveBeenCalled();
	});

	it('со ссылкой из хранилища открывает её в новой вкладке', async () => {
		const open = vi.fn();
		vi.stubGlobal('window', { open });
		get.mockResolvedValue({ data: { download_url: 'http://s3/report.xlsx' } });
		const { openErrorReport } = await load();

		await openErrorReport({ id: 'j1', result_file_id: 'f1' });

		expect(get).toHaveBeenCalledWith('/api/files/{file_id}/download-url', {
			params: { path: { file_id: 'f1' }, query: { entity_type: 'import_job', entity_id: 'j1' } }
		});
		expect(open).toHaveBeenCalledWith('http://s3/report.xlsx', '_blank', 'noopener');
	});
});

describe('rowSummary', () => {
	it('лицензия: договор, вендор, ПО — без UUID организации', async () => {
		const { rowSummary } = await load();
		const data = { organization_id: '01a14ec0-4c70-7000-ace5-37bf5569633a', vendor: 'Астра Линукс', product_name: 'Astra Linux', contract_number: 'ЛД-2026/001', comment: 'x' };
		expect(rowSummary(data)).toBe('ЛД-2026/001 · Астра Линукс · Astra Linux');
	});
	it('UUID-значение в обычном поле тоже скрыто; пусто — пустая строка', async () => {
		const { rowSummary } = await load();
		expect(rowSummary({ name: 'Вуз', ref: '01a14ec0-4c70-7000-ace5-37bf5569633a', inn: '7700' })).toBe('Вуз · 7700');
		expect(rowSummary(null)).toBe('');
	});
	it('прежний порядок для остальных типов: заявка, название', async () => {
		const { rowSummary } = await load();
		expect(rowSummary({ foo: 1, order_number: 'A-1', name: 'Курс' })).toBe('A-1 · Курс · 1');
	});
});
