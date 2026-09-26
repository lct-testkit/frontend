import { beforeEach, describe, expect, it, vi } from 'vitest';

// Мастер импорта без браузера: сеть, навигация, тосты и опрос подменены, проверяется только состояние мастера.
const get = vi.hoisted(() => vi.fn());
const pollerStop = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/api', () => ({
	api: { GET: get, POST: vi.fn(), PUT: vi.fn() },
	unwrap: async (request: Promise<{ data?: unknown; error?: unknown }>) => {
		const response = await request;
		if (response.error) throw new Error(String(response.error));
		return response.data;
	},
	idem: () => ({}),
	errorMessage: (e: unknown) => String(e),
	ApiError: class ApiError extends Error {}
}));
vi.mock('$lib/api/upload', () => ({ uploadFile: vi.fn() }));
vi.mock('$lib/ui', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../shared/polling.svelte', () => ({ createPoller: () => ({ start: vi.fn(), stop: pollerStop }) }));

const field = (target: string, label: string, required = false) => ({ target, label, kind: 'text', required });
const TYPES = [
	{
		code: 'organization',
		label: 'Организации',
		source_formats: ['xlsx', 'csv'],
		fields: [field('name', 'Наименование', true), field('inn', 'ИНН', true), field('legal_address', 'Адрес')],
		requirements: ['Наименование', 'ИНН']
	},
	{ code: 'payment', label: 'Оплаты', source_formats: ['json'], fields: [field('order_number', 'Номер заявки', true)], requirements: ['Номер заявки'] }
];

async function newFlow() {
	vi.resetModules();
	const { ImportFlow } = await import('./flow.svelte');
	return new ImportFlow();
}

const file = (name: string, size = 1024) => ({ name, size }) as File;

beforeEach(() => {
	get.mockReset();
	pollerStop.mockReset();
});

describe('типы сущностей', () => {
	it('загружаются один раз и определяют текущий тип', async () => {
		get.mockResolvedValue({ data: { items: TYPES } });
		const flow = await newFlow();

		await flow.loadTypes();
		await flow.loadTypes();

		expect(flow.entityTypes).toHaveLength(2);
		expect(get).toHaveBeenCalledTimes(1);
		expect(flow.entityType?.code).toBe('organization');
		flow.entity = 'payment';
		expect(flow.entityType?.label).toBe('Оплаты');
	});

	it('ошибка загрузки сохраняется для показа, типов нет', async () => {
		get.mockResolvedValue({ error: 'нет сети' });
		const flow = await newFlow();

		await flow.loadTypes();

		expect(String(flow.typesError)).toContain('нет сети');
		expect(flow.entityTypes).toEqual([]);
		expect(flow.entityType).toBeNull();
		expect(flow.typesLoading).toBe(false);
	});
});

describe('сопоставление колонок', () => {
	it('колонку можно назначить полю и снять; проверка следит за обязательными полями', async () => {
		get.mockResolvedValue({ data: { items: TYPES } });
		const flow = await newFlow();
		await flow.loadTypes();
		flow.profile = { headers: ['Название', 'ИНН', 'Город'], sample_rows: [], suggested_mapping: {}, total_rows: 0 };

		flow.setTarget('Название', 'name');
		expect(flow.check.ok).toBe(false);
		expect(flow.check.missing).toEqual(['ИНН']);

		flow.setTarget('ИНН', 'inn');
		expect(flow.check.ok).toBe(true);

		flow.setTarget('ИНН', null);
		expect(flow.mapping).toEqual({ Название: 'name' });
	});

	it('пресет накладывается на текущий маппинг и сбрасывается при ручной правке', async () => {
		get.mockResolvedValue({ data: { items: TYPES } });
		const flow = await newFlow();
		await flow.loadTypes();
		flow.profile = { headers: ['Название', 'ИНН'], sample_rows: [], suggested_mapping: {}, total_rows: 0 };
		flow.presets = [{ id: 'p1', name: 'Реестр', entity_type: 'organization', mapping: { ИНН: 'inn', Нет: 'name' }, created_at: '2026-09-26T00:00:00Z' }];

		flow.usePreset('p1');
		expect(flow.presetId).toBe('p1');
		expect(flow.mapping).toEqual({ ИНН: 'inn' });

		flow.setTarget('Название', 'name');
		expect(flow.presetId).toBeNull();
	});
});

describe('выбор файла', () => {
	it('подходящий файл принимается', async () => {
		const flow = await newFlow();
		flow.pickFile(file('реестр.xlsx'));
		expect(flow.file?.name).toBe('реестр.xlsx');
		expect(flow.fileError).toBeNull();
	});

	it('чужое расширение и слишком большой файл отклоняются с пояснением', async () => {
		const flow = await newFlow();

		flow.pickFile(file('архив.zip'));
		expect(flow.file).toBeNull();
		expect(flow.fileError).toMatch(/JSON/);

		flow.pickFile(file('огромный.xlsx', 60 * 1024 * 1024));
		expect(flow.file).toBeNull();
		expect(flow.fileError).toMatch(/50 МБ/);

		flow.pickFile(null);
		expect(flow.fileError).toBeNull();
	});

	it('формат должен подходить выбранному типу', async () => {
		get.mockResolvedValue({ data: { items: TYPES } });
		const flow = await newFlow();
		await flow.loadTypes();

		flow.entity = 'organization';
		flow.pickFile(file('оплаты.json'));
		expect(flow.file).toBeNull();

		flow.entity = 'payment';
		flow.pickFile(file('оплаты.json'));
		expect(flow.file?.name).toBe('оплаты.json');
	});
});

describe('остановка', () => {
	it('останавливает опрос задания', async () => {
		const flow = await newFlow();
		flow.stop();
		expect(pollerStop).toHaveBeenCalled();
	});
});
