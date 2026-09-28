import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `SendDraft` зовёт `$lib/api` напрямую (api.GET для сделки/контакта), плюс три соседних модуля
// (./api, ./known, $lib/api/upload) — все подменены. `./status` (externalNotFirstWarning) —
// настоящий, чистая логика, уже покрыта своим тестом, мокать незачем.
const get = vi.hoisted(() => vi.fn());
const createDocument = vi.hoisted(() => vi.fn());
const sendDocument = vi.hoisted(() => vi.fn());
const listTemplates = vi.hoisted(() => vi.fn());
const rememberDocument = vi.hoisted(() => vi.fn());
const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('$lib/api', async () => {
	const real = await vi.importActual<typeof import('$lib/api/errors')>('$lib/api/errors');
	return {
		api: { GET: get },
		unwrap: async (request: Promise<{ data?: unknown; error?: unknown; response: Response }>) => {
			const result = await request;
			if (result.error !== undefined || !result.response.ok) throw real.ApiError.fromProblem(result.response.status, result.error, result.response.headers);
			return result.data;
		},
		ApiError: real.ApiError
	};
});
vi.mock('$lib/api/upload', () => ({ uploadFile }));
vi.mock('./api', () => ({ createDocument, sendDocument, listTemplates }));
vi.mock('./known', () => ({ rememberDocument }));

const load = () => import('./send-draft.svelte');
const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });

const deal = (over: Partial<{ number: string; contact_id: string | null; organization_id: string | null }> = {}) => ({
	deal: { number: 'D-1', contact_id: null, organization_id: 'org-1', ...over }
});

const template = (over: Record<string, unknown> = {}) => ({
	code: 'nda',
	name: 'NDA',
	doc_type: 'kp',
	default_deadline_days: 5,
	required_signer_roles: [{ role: 'HEAD' }],
	...over
});

beforeEach(() => {
	get.mockReset();
	createDocument.mockReset();
	sendDocument.mockReset();
	listTemplates.mockReset();
	rememberDocument.mockReset();
	uploadFile.mockReset();
});

describe('SendDraft.load', () => {
	it('без контакта — deal.contactName пуст, шаблон по умолчанию выбран', async () => {
		get.mockImplementation((path: string) => (path === '/api/deals/{deal_id}' ? Promise.resolve(ok(deal())) : Promise.resolve(ok(null))));
		listTemplates.mockResolvedValue([template()]);
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');

		await s.load();

		expect(s.loading).toBe(false);
		expect(s.deal).toMatchObject({ number: 'D-1', contactId: null, contactName: null, organizationId: 'org-1' });
		expect(s.templateCode).toBe('nda');
		expect(s.source).toBe('template');
	});

	it('с контактом — имя собирается из фамилии/имени/отчества', async () => {
		get.mockImplementation((path: string) => {
			if (path === '/api/deals/{deal_id}') return Promise.resolve(ok(deal({ contact_id: 'c-1' })));
			return Promise.resolve(ok({ last_name: 'Иванов', first_name: 'Иван', middle_name: null }));
		});
		listTemplates.mockResolvedValue([]);
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');

		await s.load();

		expect(s.deal?.contactName).toBe('Иванов Иван');
		expect(s.source).toBe('file'); // шаблонов нет — источник переключается на файл
	});

	it('ошибка — loadError сохранён, не бросает дальше', async () => {
		get.mockRejectedValue(new Error('boom'));
		listTemplates.mockResolvedValue([]);
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');

		await s.load();

		expect(s.loadError).toBeInstanceOf(Error);
		expect(s.loading).toBe(false);
	});
});

describe('SendDraft.pickTemplate — подписанты по умолчанию из шаблона', () => {
	async function ready(templates: unknown[], contactId: string | null = null, organizationId: string | null = 'org-1') {
		get.mockImplementation((path: string) => (path === '/api/deals/{deal_id}' ? Promise.resolve(ok(deal({ contact_id: contactId, organization_id: organizationId }))) : Promise.resolve(ok(null))));
		listTemplates.mockResolvedValue(templates);
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');
		await s.load();
		return s;
	}

	it('роль HEAD в шаблоне — включает «руководителя»', async () => {
		const s = await ready([template({ required_signer_roles: [{ role: 'HEAD' }] })]);
		expect(s.head).toBe(true);
		expect(s.contact).toBe(false);
	});

	it('contact_role в шаблоне при известном контакте — включает «контакт», не ЛПР', async () => {
		const s = await ready([template({ code: 't2', required_signer_roles: [{ contact_role: 'employee' }] })], 'c-1');
		expect(s.contact).toBe(true);
		expect(s.lpr).toBe(false);
	});

	it('decision_maker без контакта, но с организацией — ЛПР, не контакт', async () => {
		const s = await ready([template({ code: 't3', required_signer_roles: [{ contact_role: 'decision_maker' }] })], null, 'org-1');
		expect(s.lpr).toBe(true);
		expect(s.contact).toBe(false);
	});

	it('ни одна роль не подошла — подстраховка: включает «руководителя»', async () => {
		const s = await ready([template({ code: 't4', required_signer_roles: [{ contact_role: 'someone_else' }] })], null, null);
		expect(s.head).toBe(true);
	});

	it('название по умолчанию — «шаблон · номер сделки», пока пользователь не начал печатать своё', async () => {
		const s = await ready([template({ name: 'НДА' })]);
		expect(s.title).toBe('НДА · D-1');
		s.setTitle('Моё название');
		s.pickTemplate('nda');
		expect(s.title).toBe('Моё название'); // titleTouched — авто-название больше не перезаписывает
	});
});

describe('SendDraft.signers / warnExternalNotFirst / canSubmit', () => {
	async function blank() {
		get.mockImplementation((path: string) => (path === '/api/deals/{deal_id}' ? Promise.resolve(ok(deal({ contact_id: 'c-1' }))) : Promise.resolve(ok(null))));
		listTemplates.mockResolvedValue([]);
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');
		await s.load();
		return s;
	}

	it('порядок строго руководитель -> контакт -> ЛПР -> сотрудник', async () => {
		const s = await blank();
		s.head = true;
		s.contact = true;
		s.lpr = true;
		s.user = { id: 'u-1', name: 'Сотрудник' };
		expect(s.signers.map((x) => x.type)).toEqual(['internal', 'external', 'external', 'internal']);
	});

	it('внешний подписант не первым при последовательном порядке — предупреждение', async () => {
		const s = await blank();
		s.head = true;
		s.contact = true;
		s.order = 'sequential';
		expect(s.warnExternalNotFirst).toBe(true);
		s.order = 'parallel';
		expect(s.warnExternalNotFirst).toBe(false);
	});

	it('canSubmit — нужны короткое название (3+), источник и хотя бы один подписант', async () => {
		const s = await blank();
		expect(s.canSubmit).toBe(false); // ни названия, ни источника
		s.setTitle('До');
		expect(s.canSubmit).toBe(false); // короче 3 символов
		s.setTitle('Договор');
		s.source = 'file';
		expect(s.canSubmit).toBe(false); // источник выбран, но файла нет
		s.file = { id: 'f-1', name: 'file.pdf' };
		s.head = false;
		s.contact = false;
		expect(s.canSubmit).toBe(false); // ни одного подписанта
		s.head = true;
		expect(s.canSubmit).toBe(true);
	});
});

describe('SendDraft.pickFile', () => {
	it('успех — файл сохранён, прогресс сброшен, название подставлено из имени файла', async () => {
		get.mockImplementation((path: string) => (path === '/api/deals/{deal_id}' ? Promise.resolve(ok(deal())) : Promise.resolve(ok(null))));
		listTemplates.mockResolvedValue([]);
		uploadFile.mockImplementation(async (_file: File, opts: { onProgress?: (f: number) => void }) => {
			opts.onProgress?.(0.5);
			return { id: 'file-1' };
		});
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');
		await s.load();
		s.source = 'file';

		await s.pickFile(new File(['x'], 'Договор.pdf'));

		expect(s.file).toEqual({ id: 'file-1', name: 'Договор.pdf' });
		expect(s.uploading).toBe(0);
		expect(s.title).toBe('Договор · D-1');
	});

	it('ошибка — текст ApiError.detail, файл не выставлен', async () => {
		get.mockImplementation((path: string) => (path === '/api/deals/{deal_id}' ? Promise.resolve(ok(deal())) : Promise.resolve(ok(null))));
		listTemplates.mockResolvedValue([]);
		const { ApiError } = await import('$lib/api');
		uploadFile.mockRejectedValue(new ApiError({ status: 415, detail: 'Недопустимый тип файла' }));
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');
		await s.load();

		await s.pickFile(new File(['x'], 'virus.exe'));

		expect(s.file).toBeNull();
		expect(s.error).toBe('Недопустимый тип файла');
	});
});

describe('SendDraft.submit', () => {
	async function readyToSubmit() {
		get.mockImplementation((path: string) => (path === '/api/deals/{deal_id}' ? Promise.resolve(ok(deal())) : Promise.resolve(ok(null))));
		listTemplates.mockResolvedValue([template()]);
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');
		await s.load();
		s.setTitle('Договор поставки');
		return s;
	}

	it('canSubmit=false или уже busy — submit ничего не делает', async () => {
		const s = await readyToSubmit();
		s.head = false;
		s.contact = false; // ни одного подписанта -> canSubmit false
		expect(await s.submit()).toBeNull();
		expect(createDocument).not.toHaveBeenCalled();
	});

	it('успех — создаёт документ, запоминает его, отправляет, возвращает результат', async () => {
		const created = { id: 'doc-1' };
		const sent = { id: 'doc-1', status: 'sent' };
		createDocument.mockResolvedValue(created);
		sendDocument.mockResolvedValue(sent);
		const s = await readyToSubmit();

		const result = await s.submit();

		expect(result).toBe(sent);
		expect(rememberDocument).toHaveBeenCalledWith('doc-1', 'deal-1');
		expect(sendDocument).toHaveBeenCalledWith('doc-1');
		expect(s.busy).toBe(false);
	});

	it('ошибка на поле «подписанты» — signersError, не общий error', async () => {
		// `signersError` в коде всегда берёт `e.detail` (общий текст problem detail), не текст конкретной причины
		// поля — `fieldError('signers')` там служит только триггером «это ошибка про подписантов».
		const { ApiError } = await import('$lib/api');
		createDocument.mockRejectedValue(new ApiError({ status: 422, detail: 'Подписант не определён', errors: [{ field: 'signers', reason: 'Подписант не определён' }] }));
		const s = await readyToSubmit();

		const result = await s.submit();

		expect(result).toBeNull();
		expect(s.signersError).toBe('Подписант не определён');
		expect(s.error).toBeNull();
	});

	it('прочая ошибка создания — общий error, не signersError', async () => {
		const { ApiError } = await import('$lib/api');
		createDocument.mockRejectedValue(new ApiError({ status: 500, detail: 'Сервер недоступен' }));
		const s = await readyToSubmit();

		await s.submit();

		expect(s.error).toBe('Сервер недоступен');
		expect(s.signersError).toBeNull();
	});
});

describe('SendDraft.submit — повтор при «файл ещё проверяется антивирусом» (422)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	async function readyToSubmit() {
		get.mockImplementation((path: string) => (path === '/api/deals/{deal_id}' ? Promise.resolve(ok(deal())) : Promise.resolve(ok(null))));
		listTemplates.mockResolvedValue([template()]);
		const { SendDraft } = await load();
		const s = new SendDraft('deal-1');
		await s.load();
		s.setTitle('Договор поставки');
		return s;
	}

	it('пара неудач подряд, затем успех — не бросает, не плодит повторные документы', async () => {
		const { ApiError } = await import('$lib/api');
		const scanning = new ApiError({ status: 422, detail: 'Файл не прошёл проверку антивирусом' });
		const created = { id: 'doc-1' };
		createDocument.mockRejectedValueOnce(scanning).mockRejectedValueOnce(scanning).mockResolvedValueOnce(created);
		sendDocument.mockResolvedValue({ id: 'doc-1', status: 'sent' });
		const s = await readyToSubmit();

		const pending = s.submit();
		await vi.advanceTimersByTimeAsync(2000);
		await vi.advanceTimersByTimeAsync(2000);
		const result = await pending;

		expect(result).toMatchObject({ id: 'doc-1' });
		expect(createDocument).toHaveBeenCalledTimes(3);
	});

	it('шесть неудач подряд — сдаётся и пробрасывает исходную ошибку как error', async () => {
		const { ApiError } = await import('$lib/api');
		const scanning = new ApiError({ status: 422, detail: 'Файл не прошёл проверку антивирусом' });
		createDocument.mockRejectedValue(scanning);
		const s = await readyToSubmit();

		const pending = s.submit();
		for (let i = 0; i < 5; i += 1) await vi.advanceTimersByTimeAsync(2000);
		const result = await pending;

		expect(result).toBeNull();
		expect(s.error).toBe('Файл не прошёл проверку антивирусом');
		expect(createDocument).toHaveBeenCalledTimes(6);
	});
});
