// Отчёты и дашборды (агент B): сквозной сценарий на живом бэкенде — запуск отчёта, скачивание, история, дашборд с виджетами из xlsx.
// Создаёт общий дашборд «Обзор воронки» (демо-данные) и оставляет его в базе.
//   node tools/scenarios/b-reports.mjs
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
const pick = async (page, scope, label, text) => {
	await field(scope, label).click();
	await page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: text }).first().click();
	await page.waitForTimeout(150);
};

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await api('admin', 'GET', '/api/me');

	console.log('Галерея и запуск');
	await page.goto(`${BASE}/reports`);
	await page.waitForSelector('text=Воронка по статусам');
	check((await page.locator('ul li button').count()) >= 7, 'галерея: карточки шаблонов (ADMIN видит все)');
	await page.getByRole('button', { name: /Воронка по статусам/ }).click();
	const drawer = page.locator('.atmr-drawer');
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await page.waitForSelector('text=Отчёт готов', { timeout: 60000 });
	ok('xlsx сформирован: «Отчёт готов»');
	await page.screenshot({ path: '.shots/b-data/reports-done.png' });
	const mine = (await api('admin', 'GET', '/api/reports?limit=5')).json.items;
	const job = mine[0];
	check(job.status === 'completed' && job.template_code === 'deal_funnel', 'в истории API — готовый deal_funnel');
	const dl = (await api('admin', 'GET', `/api/reports/${job.id}/download`)).json;
	const file = await fetch(dl.url);
	check(file.ok && (await file.arrayBuffer()).byteLength > 1000, 'ссылка на файл отдаёт xlsx из хранилища');
	await drawer.getByRole('button', { name: 'Закрыть', exact: true }).last().click();

	console.log('Параметры и ошибки');
	await page.getByRole('button', { name: /Динамика по месяцам/ }).click();
	await field(drawer, 'Месяцев').locator('input').fill('99');
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await page.waitForTimeout(500);
	check((await drawer.locator('.atmr-input--error').count()) > 0, 'месяцев = 99: ошибка формы (1–36), запуска нет');
	await page.keyboard.press('Escape');

	console.log('История');
	await page.goto(`${BASE}/reports/history`);
	await page.waitForSelector('text=Воронка по статусам');
	check((await page.getByText('Готов', { exact: true }).count()) > 0, 'история: статус «Готов»');

	console.log('Дашборд');
	let dash = (await api('admin', 'GET', '/api/dashboards?limit=100')).json.items.find((d) => d.name === 'Обзор воронки');
	if (!dash) {
		await page.goto(`${BASE}/reports/dashboards`);
		await page.getByRole('button', { name: 'Создать дашборд' }).first().click();
		await field(page.locator('.atmr-drawer'), 'Название').locator('input').fill('Обзор воронки');
		await page.locator('.atmr-drawer').getByText('Общий', { exact: true }).click();
		await page.locator('.atmr-drawer').getByRole('button', { name: 'Создать' }).click();
		await page.waitForURL(/\/reports\/dashboards\/[0-9a-f-]{36}/);
		dash = (await api('admin', 'GET', '/api/dashboards?limit=100')).json.items.find((d) => d.name === 'Обзор воронки');
		ok('дашборд создан (общий)');
	}
	await page.goto(`${BASE}/reports/dashboards/${dash.id}`);
	await page.waitForSelector('text=Обзор воронки');
	const have = (await api('admin', 'GET', `/api/dashboards/${dash.id}/widgets`)).json.items;
	if (have.length === 0) {
		await page.getByLabel('Изменить дашборд').click();
		const add = async (type, report, extra) => {
			await page.getByRole('button', { name: 'Виджет', exact: true }).click();
			const d = page.locator('.atmr-drawer');
			await d.getByText(type, { exact: true }).click();
			await pick(page, d, 'Отчёт', report);
			if (extra) await extra(d);
			await d.getByRole('button', { name: 'Добавить' }).click();
			await page.waitForTimeout(900);
		};
		await add('Показатель', 'Воронка по статусам', (d) => pick(page, d, 'Показатель', 'Сумма: Сейчас в статусе'));
		await add('Показатель', 'Динамика по месяцам', (d) => pick(page, d, 'Показатель', 'Сумма: Создано'));
		await add('График', 'Воронка по статусам', async (d) => d.getByText('Вся ширина', { exact: true }).click());
		await add('График', 'Динамика по месяцам');
		await add('График', 'Причины отказов');
		await add('Таблица', 'Зависшие сделки', async (d) => d.getByText('Вся ширина', { exact: true }).click());
		ok('добавлены 6 виджетов (2 показателя, 3 графика, таблица)');
		await page.getByLabel('Готово').click();
	}
	await page.getByRole('button', { name: 'Обновить данные' }).click();
	await page.waitForFunction(() => document.querySelectorAll('article svg').length >= 2, null, { timeout: 120000 }).catch(() => {});
	await page.waitForTimeout(1500);
	const svgs = await page.locator('article svg').count();
	check(svgs >= 2, `графики нарисованы из файлов отчётов (svg: ${svgs})`);
	const noData = await page.getByText('Нет данных — нажмите').count();
	check(noData === 0, 'у всех виджетов есть данные');
	await page.screenshot({ path: '.shots/b-data/dashboard.png', fullPage: true });

	console.log('Роли');
	const kam = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
	await api('kam', 'GET', '/api/me');
	await kam.goto(`${BASE}/reports`);
	await kam.waitForSelector('text=Воронка по статусам');
	check((await kam.getByRole('button', { name: /Сводка по КАМам/ }).count()) === 0, 'KAM не видит отчёт «Сводка по КАМам»');
	await kam.goto(`${BASE}/reports/dashboards/${dash.id}`);
	await kam.waitForSelector('text=Обзор воронки');
	check((await kam.getByLabel('Изменить дашборд').count()) === 0, 'KAM видит общий дашборд, но не может его менять');

	const p = page.__problems;
	console.log(p.pageerrors.length ? `  ✗ page errors: ${p.pageerrors.join(' | ')}` : '  ✓ нет исключений на странице');
	const real = p.console.filter((c) => !/status of (409|422|429)/.test(c));
	console.log(real.length ? `  ✗ console: ${real.join(' | ')}` : '  ✓ нет ошибок консоли');
	if (p.failed.length) console.log(`  · неудачные запросы: ${[...new Set(p.failed)].join(' | ')}`);
} finally {
	await browser.close();
}
