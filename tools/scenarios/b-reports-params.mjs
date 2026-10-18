// Параметры отчётов (F1-14): поля каждого шаблона, серверный поиск вузов, запуск «Сделок по вузам» с фильтрами и колонками, дата «по» раньше «с».
// Нужны более 20 организаций («Университет «Тест-F1-NNN»» из подготовки стенда или tools/seed-demo.mjs).
//   node tools/scenarios/b-reports-params.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));

async function api(who, method, path, body) {
	const token = await accessToken(who);
	const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}
const field = (scope, label) => scope.locator('.atmr-input', { has: scope.page().locator(`.atmr-input__label :text-is("${label}")`) }).last();
const ITEM = '[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]';
const labelsOf = (drawer) => drawer.locator('.atmr-input__label').allInnerTexts().then((l) => l.map((t) => t.replace(/\s*\*$/, '').trim()).filter(Boolean));

// ожидаемые подписи полей по шаблонам (таблица F1-1): без «Формат» и «Колонки», они рисуются отдельно
const COMMON = ['Вузы', 'Направления', 'Продукты'];
const OWNERS = 'Ответственные по сделке';
const EXPECT = {
	deal_funnel: ['Тип сделки', 'Воронка', 'Период считать по', 'Период', ...COMMON, OWNERS],
	deal_register: ['Период считать по', 'Период', ...COMMON, OWNERS, 'Не больше строк'],
	kam_summary: ['Период считать по', 'Период', ...COMMON, 'КАМы в сводке'],
	loss_reasons: ['Сделка закрыта', ...COMMON, OWNERS],
	monthly_dynamics: ['Месяцев', 'Период', ...COMMON, OWNERS],
	region_summary: ['Период считать по', 'Период', ...COMMON, OWNERS],
	sla_compliance: ['Период считать по', 'Период', ...COMMON, OWNERS],
	stuck_deals: ['Период считать по', 'Период', ...COMMON, OWNERS, 'Не больше строк'],
	product_demand: ['Группировать по', 'Упорядочить по', 'Показать первые', 'Период считать по', 'Период', ...COMMON, OWNERS],
	license_register: ['Период считать по', 'Период', 'Вузы', 'Вендоры', 'Статус по передаче', 'Год окончания', 'Не больше строк'],
	learning_progress: ['Период считать по', 'Период', ...COMMON, OWNERS, 'Не больше строк'],
	lms_users_upload: ['Курс', 'Номер потока', 'Сделки с', 'Сделки по']
};

// Escape закрыл бы всю панель: выпадающий список закрываем щелчком по подписи «Формат»
let closeMenu;
const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	const me = await api('admin', 'GET', '/api/me');
	check(me.status === 200, 'вход под администратором');
	const templates = (await api('admin', 'GET', '/api/report-templates')).json.items.filter((t) => t.is_active);
	const orgRequests = [];
	page.on('request', (r) => {
		if (r.url().includes('/api/organizations')) orgRequests.push(new URL(r.url()).searchParams);
	});
	const drawer = page.locator('.atmr-drawer');
	closeMenu = async () => {
		await drawer.getByText('Формат', { exact: true }).first().click();
		await page.waitForTimeout(250);
	};

	console.log('Поля каждого шаблона');
	await page.goto(`${BASE}/reports`);
	await page.waitForSelector('text=Воронка по статусам');
	check(orgRequests.length === 0, 'галерея и открытие панелей не грузят список вузов (проверяется ниже после открытия)');
	for (const t of templates) {
		const want = EXPECT[t.code];
		if (!want) {
			fail(`шаблон «${t.name}» (${t.code}) есть на сервере, а в сценарии нет ожидаемых полей`);
			continue;
		}
		await page.getByRole('button', { name: new RegExp(t.name.replace(/[()]/g, '\\$&').slice(0, 24)) }).first().click();
		await page.waitForTimeout(500);
		const got = await labelsOf(drawer);
		const missing = want.filter((l) => !got.some((g) => g === l || g.startsWith(l)));
		check(missing.length === 0, `${t.code}: поля на месте${missing.length ? ` (нет: ${missing.join(', ')}; есть: ${got.join(', ')})` : ''}`);
		await drawer.getByRole('button', { name: 'Отмена' }).click();
		await page.waitForTimeout(300);
	}
	check(orgRequests.length === 0, 'при открытии 12 панелей запросов к /api/organizations нет');

	console.log('Серверный поиск вузов и «Показать ещё»');
	await page.getByRole('button', { name: /Сделки по вузам/ }).click();
	await page.waitForTimeout(500);
	await field(drawer, 'Вузы').click();
	await page.waitForSelector(ITEM);
	check(orgRequests.length === 1 && !orgRequests[0].has('q'), 'первое открытие списка: один запрос без q');
	await page.keyboard.type('Тест-F1', { delay: 30 });
	await page.waitForTimeout(900);
	const withQ = orgRequests.filter((p) => p.get('q') === 'Тест-F1');
	check(withQ.length === 1, `после ввода: один запрос с q (запросов с q: ${withQ.length})`);
	const firstPage = await page.locator(ITEM).count();
	const more = page.getByText('Показать ещё');
	if (await more.count()) {
		await more.first().click();
		await page.waitForTimeout(700);
		check(orgRequests.some((q) => q.get('q') === 'Тест-F1' && q.has('cursor')), `«Показать ещё»: ушёл запрос со следующей страницей (cursor), в списке ${firstPage} → ${await page.locator(ITEM).count()}`);
	} else ok('у выдачи по запросу одна страница — «Показать ещё» нет (подгрузка проверяется в vitest remote-list.test.ts)');
	await page.locator(ITEM).nth(0).click();
	await page.locator(ITEM).nth(1).click().catch(() => {});
	await page.waitForTimeout(200);
	await closeMenu();
	const chosen = await drawer.locator('.atmr-tag, [class*="tag"]').allInnerTexts();
	check(chosen.some((t) => /Тест-F1/.test(t)), 'выбранные вузы остались тегами после поиска');

	console.log('Направление, колонки «Как в ТЗ», запуск');
	await field(drawer, 'Направления').click();
	await page.locator(ITEM).first().click();
	await closeMenu();
	const dirChosen = await field(drawer, 'Направления').innerText();
	await drawer.getByRole('button', { name: 'Как в ТЗ' }).click().catch(async () => {
		await drawer.getByText(/Колонки/).first().click();
		await drawer.getByRole('button', { name: 'Как в ТЗ' }).click();
	});
	await drawer.getByRole('button', { name: 'Квартал' }).click();
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await page.waitForSelector('text=Отчёт готов', { timeout: 60000 });
	const job = (await api('admin', 'GET', '/api/reports?limit=1')).json.items[0];
	const params = (await api('admin', 'GET', `/api/reports/${job.id}`)).json.params ?? {};
	check(job.template_code === 'deal_register' && job.status === 'completed', 'отчёт «Сделки по вузам» готов');
	check(Array.isArray(params.organization_ids) && params.organization_ids.length >= 1, `params.organization_ids: ${JSON.stringify(params.organization_ids)}`);
	check(Array.isArray(params.direction_ids) && params.direction_ids.length === 1, `params.direction_ids (выбрано: ${dirChosen.replace(/\n/g, ' ')})`);
	check(Array.isArray(params.columns) && params.columns.length >= 3, `params.columns: ${params.columns?.length} шт.`);
	check(Boolean(params.date_from) && Boolean(params.date_to), `params.date_from/date_to: ${params.date_from} — ${params.date_to}`);
	await drawer.getByRole('button', { name: 'Закрыть', exact: true }).last().click();

	console.log('Дата «по» раньше «с»');
	// поле-диапазон само ставит даты по порядку, поэтому в запрос неверный период попасть не может; сама проверка validateParams — в params.test.ts
	await page.getByRole('button', { name: /Сделки по вузам/ }).click();
	await page.waitForTimeout(500);
	await drawer.locator('input[name="df"]').fill('15.10.2026');
	await drawer.locator('input[name="dt"]').fill('01.10.2026');
	await drawer.locator('input[name="dt"]').press('Tab');
	await page.waitForTimeout(300);
	check((await drawer.locator('input[name="df"]').inputValue()) === '01.10.2026' && (await drawer.locator('input[name="dt"]').inputValue()) === '15.10.2026', 'поле-диапазон переставило даты по порядку (с 01.10 по 15.10)');
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await page.waitForSelector('text=Отчёт готов', { timeout: 60000 });
	const last = (await api('admin', 'GET', '/api/reports?limit=1')).json.items[0];
	const sent = (await api('admin', 'GET', `/api/reports/${last.id}`)).json.params ?? {};
	check(sent.date_from === '2026-10-01' && sent.date_to === '2026-10-15', `в отчёте даты по порядку: ${sent.date_from} — ${sent.date_to}`);

	const p = page.__problems;
	check(p.pageerrors.length === 0, 'нет исключений на странице');
} finally {
	await browser.close();
}
