import { beforeEach, describe, expect, it, vi } from 'vitest';

// Мастер импорта без браузера: сеть, навигация, тосты, загрузка и опрос подменены, проверяется только состояние мастера.
const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const pollerStart = vi.hoisted(() => vi.fn());
const pollerStop = vi.hoisted(() => vi.fn());
const pollerBody = vi.hoisted(() => ({ run: null as null | (() => Promise<boolean>) }));
const uploadFile = vi.hoisted(() => vi.fn());
const goto = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$lib/api', () => ({
	api: { GET: get, POST: post, PUT: put },
	unwrap: async (request: Promise<{ data?: unknown; error?: unknown }>) => {
		const response = await request;
		if (response.error) throw new Error(String(response.error));
		return response.data;
	},
	idem: () => ({}),
	errorMessage: (e: unknown) => String(e),
	ApiError: class ApiError extends Error {}
}));
vi.mock('$lib/api/upload', () => ({ uploadFile }));
vi.mock('$lib/ui', () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock('../shared/polling.svelte', () => ({
	createPoller: (run: () => Promise<boolean>) => {
		pollerBody.run = run;
		return { start: pollerStart, stop: pollerStop };
	}
}));

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
	for (const fn of [get, post, put, pollerStart, pollerStop, uploadFile, goto, toastError]) fn.mockReset();
	pollerBody.run = null;
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

// --- Шаги мастера: задание живёт на сервере, мастер только ведёт по шагам ---

const job = (over: Record<string, unknown> = {}) => ({
	id: 'j1',
	entity_type: 'organization',
	mode: 'upsert',
	mapping: {},
	status: 'uploaded',
	total_rows: 2,
	ok_rows: 0,
	warn_rows: 0,
	error_rows: 0,
	rollback_available: false,
	...over
});
const PROFILE = { headers: ['Название', 'ИНН'], sample_rows: [], suggested_mapping: { Название: 'name', ИНН: 'inn' }, total_rows: 2 };

/** GET отвечает по адресу: типы, задание, профиль, пресеты. */
function serve(current: Record<string, unknown>) {
	get.mockImplementation(async (url: string) => {
		if (url === '/api/imports/entity-types') return { data: { items: TYPES } };
		if (url === '/api/imports/{job_id}') return { data: current };
		if (url === '/api/imports/{job_id}/profile') return { data: PROFILE };
		if (url === '/api/import-presets') return { data: { items: [] } };
		return { error: `не подготовлено: ${url}` };
	});
}

describe('восстановление по ссылке', () => {
	it('задание без сопоставления открывается на шаге «Сопоставление» с подсказкой сервера', async () => {
		serve(job({ status: 'uploaded' }));
		const flow = await newFlow();

		await flow.restore('j1');

		expect(flow.step).toBe(1);
		expect(flow.loading).toBe(false);
		expect(flow.mapping).toEqual({ Название: 'name', ИНН: 'inn' });
		expect(flow.headers).toEqual(['Название', 'ИНН']);
	});

	it('сохранённое сопоставление важнее подсказки', async () => {
		serve(job({ status: 'uploaded', mapping: { Название: 'legal_address' } }));
		const flow = await newFlow();

		await flow.restore('j1');

		expect(flow.mapping).toEqual({ Название: 'legal_address' });
	});

	it('применяемое задание — шаг «Применение» с опросом', async () => {
		serve(job({ status: 'applying' }));
		const flow = await newFlow();

		await flow.restore('j1');

		expect(flow.step).toBe(3);
		expect(pollerStart).toHaveBeenCalledWith(true);
	});

	it('ошибка запроса показывается, а не глотается', async () => {
		get.mockResolvedValue({ error: 'нет доступа' });
		const flow = await newFlow();

		await flow.restore('j1');

		expect(String(flow.error)).toContain('нет доступа');
		expect(flow.loading).toBe(false);
	});
});

describe('загрузка файла', () => {
	it('файл уходит в хранилище, создаётся задание, мастер переходит к сопоставлению', async () => {
		serve(job());
		uploadFile.mockResolvedValue({ id: 'f1' });
		post.mockResolvedValue({ data: job() });
		const flow = await newFlow();
		await flow.loadTypes();
		flow.pickFile(file('реестр.xlsx'));

		await flow.upload();

		expect(post).toHaveBeenCalledWith('/api/imports', expect.objectContaining({ body: { file_id: 'f1', entity_type: 'organization', mode: 'upsert', source_format: 'xlsx' } }));
		expect(goto).toHaveBeenCalledWith('/imports/new?job=j1', expect.anything());
		expect(flow.step).toBe(1);
		expect(flow.uploading).toBe(false);
		expect(flow.profile?.headers).toEqual(['Название', 'ИНН']);
	});

	it('без файла ничего не делает', async () => {
		const flow = await newFlow();
		await flow.upload();
		expect(uploadFile).not.toHaveBeenCalled();
	});

	it('сбой загрузки возвращает на шаг «Файл» с текстом ошибки', async () => {
		uploadFile.mockRejectedValue(new Error('хранилище недоступно'));
		const flow = await newFlow();
		flow.pickFile(file('реестр.xlsx'));

		await flow.upload();

		expect(flow.step).toBe(0);
		expect(flow.fileError).toContain('хранилище недоступно');
		expect(flow.uploading).toBe(false);
	});
});

describe('сохранение сопоставления, проверка, применение, откат', () => {
	async function ready(status = 'uploaded') {
		serve(job({ status }));
		const flow = await newFlow();
		await flow.restore('j1');
		return flow;
	}

	it('сопоставление сохраняется без лишних колонок, затем идёт проверка', async () => {
		put.mockResolvedValue({ data: job({ status: 'mapped' }) });
		post.mockResolvedValue({ data: job({ status: 'validated', ok_rows: 2 }) });
		const flow = await ready();
		flow.mapping = { Название: 'name', ИНН: 'inn', Лишняя: 'legal_address' };

		await flow.saveMapping();

		expect(put).toHaveBeenCalledWith('/api/imports/{job_id}/mapping', expect.objectContaining({ body: { mapping: { Название: 'name', ИНН: 'inn' }, save_as_preset: null } }));
		expect(post).toHaveBeenCalledWith('/api/imports/{job_id}/dry-run', expect.anything());
		expect(flow.step).toBe(2);
		expect(flow.job?.status).toBe('validated');
		expect(flow.busy).toBe(false);
	});

	it('пресет сохраняется под введённым именем', async () => {
		put.mockResolvedValue({ data: job({ status: 'mapped' }) });
		post.mockResolvedValue({ data: job({ status: 'validated' }) });
		const flow = await ready();
		flow.savePreset = true;
		flow.presetName = '  Реестр вузов  ';

		await flow.saveMapping();

		expect(put.mock.calls[0][1].body.save_as_preset).toBe('Реестр вузов');
	});

	it('неполное сопоставление не отправляется', async () => {
		const flow = await ready();
		flow.mapping = { Название: 'name' };

		await flow.saveMapping();

		expect(put).not.toHaveBeenCalled();
	});

	it('ошибка сохранения — тост, шаг не меняется', async () => {
		put.mockResolvedValue({ error: 'нельзя' });
		const flow = await ready();

		await flow.saveMapping();

		expect(toastError).toHaveBeenCalled();
		expect(flow.step).toBe(1);
		expect(flow.busy).toBe(false);
	});

	it('сбой проверки сохраняется в состоянии мастера', async () => {
		post.mockResolvedValue({ error: 'сервер недоступен' });
		const flow = await ready();

		await flow.dryRun();

		expect(String(flow.error)).toContain('сервер недоступен');
	});

	it('применение переводит на шаг «Применение» и запускает опрос', async () => {
		post.mockResolvedValue({ data: job({ status: 'applying' }) });
		const flow = await ready('validated');

		await flow.apply();

		expect(post).toHaveBeenCalledWith('/api/imports/{job_id}/apply', expect.anything());
		expect(flow.step).toBe(3);
		expect(pollerStart).toHaveBeenCalled();
	});

	it('сбой применения — тост', async () => {
		post.mockResolvedValue({ error: 'нельзя применить' });
		const flow = await ready('validated');

		await flow.apply();

		expect(toastError).toHaveBeenCalled();
		expect(flow.step).not.toBe(3);
	});

	it('откат запускает опрос, сбой отката — тост', async () => {
		post.mockResolvedValueOnce({ data: job({ status: 'rolling_back' }) }).mockResolvedValueOnce({ error: 'заблокирован' });
		const flow = await ready('completed');

		await flow.rollback();
		expect(flow.job?.status).toBe('rolling_back');
		expect(flow.rollingBack).toBe(true);
		expect(pollerStart).toHaveBeenCalled();

		await flow.rollback();
		expect(toastError).toHaveBeenCalled();
	});

	it('опрос: пока идёт применение — продолжается, по завершении — шаг «Готово»', async () => {
		const flow = await ready('validated');
		const poll = pollerBody.run as () => Promise<boolean>;

		serve(job({ status: 'applying' }));
		expect(await poll()).toBe(true);

		serve(job({ status: 'completed', ok_rows: 2 }));
		expect(await poll()).toBe(false);
		expect(flow.step).toBe(4);
		expect(flow.job?.status).toBe('completed');
	});
});
