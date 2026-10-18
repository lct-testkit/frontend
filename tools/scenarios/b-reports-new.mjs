// Новые отчёты (F1-12): карточки в галерее, панели, запуск «Рейтинга востребованности», виджет-график, «Загрузка пользователей в LMS» нет в виджетах.
// Создаёт и удаляет временный дашборд «Проверка F1-12». Кадры — в каталог из --out (по умолчанию .shots/b-new).
//   node tools/scenarios/b-reports-new.mjs [--out D:/путь]
import { mkdirSync } from 'node:fs';
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.shots/b-new';
mkdirSync(out, { recursive: true });

async function api(who, method, path, body) {
	const token = await accessToken(who);
	const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}
const field = (scope, label) => scope.locator('.atmr-input', { has: scope.page().locator(`.atmr-input__label :text-is("${label}")`) }).last();
const ITEM = '[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]';

const browser = await newBrowser();
let dashId = null;
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await api('admin', 'GET', '/api/me');

	console.log('Галерея');
	await page.goto(`${BASE}/reports`);
	await page.waitForSelector('text=Воронка по статусам');
	for (const name of ['Рейтинг востребованности', 'Реестр лицензий', 'Прогресс обучения']) check((await page.getByRole('button', { name: new RegExp(name) }).count()) === 1, `карточка «${name}»`);
	check((await page.locator('ul li button').count()) >= 10, 'карточек не меньше 10');
	await page.screenshot({ path: `${out}/gallery-1440.png` });

	console.log('Запуск «Рейтинга востребованности»');
	const drawer = page.locator('.atmr-drawer');
	await page.getByRole('button', { name: /Рейтинг востребованности/ }).click();
	for (const label of ['Группировать по', 'Упорядочить по', 'Показать первые']) check((await field(drawer, label).count()) > 0, `поле «${label}»`);
	await page.waitForTimeout(600);
	await page.screenshot({ path: `${out}/demand-panel-1440.png` });
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await page.waitForSelector('text=Отчёт готов', { timeout: 60000 });
	const job = (await api('admin', 'GET', '/api/reports?limit=1')).json.items[0];
	check(job.template_code === 'product_demand' && job.status === 'completed' && job.params.top === 20, 'в истории готовый product_demand с top=20');
	await page.screenshot({ path: `${out}/demand-done-1440.png` });
	await page.keyboard.press('Escape');

	console.log('Реестр лицензий: панель');
	await page.reload();
	await page.getByRole('button', { name: /Реестр лицензий/ }).click();
	for (const label of ['Вендоры', 'Статус по передаче', 'Год окончания']) check((await field(drawer, label).count()) > 0, `лицензии: поле «${label}»`);
	check((await drawer.getByText('персональные данные').count()) > 0, 'лицензии: предупреждение о персональных данных');
	await page.waitForTimeout(600);
	await page.screenshot({ path: `${out}/licenses-panel-1440.png` });
	await page.keyboard.press('Escape');

	console.log('Виджет');
	dashId = (await api('admin', 'POST', '/api/dashboards', { name: 'Проверка F1-12', is_shared: false })).json?.id;
	check(Boolean(dashId), 'временный дашборд создан');
	await page.goto(`${BASE}/reports/dashboards/${dashId}`);
	await page.waitForSelector('text=Проверка F1-12');
	await page.getByLabel('Изменить дашборд').click();
	await page.getByRole('button', { name: 'Виджет', exact: true }).click();
	const wd = page.locator('.atmr-drawer');
	await wd.getByText('Таблица', { exact: true }).click();
	await field(wd, 'Отчёт').click();
	const items = await page.locator(ITEM).allInnerTexts();
	check(!items.some((t) => t.includes('Загрузка пользователей в LMS')), 'в списке отчётов виджета нет «Загрузка пользователей в LMS»');
	check(items.some((t) => t.includes('Рейтинг востребованности')), 'в списке виджета есть «Рейтинг востребованности»');
	await wd.getByText('График', { exact: true }).click();
	await field(wd, 'Отчёт').click();
	const chartItems = await page.locator(ITEM).allInnerTexts();
	check(chartItems.some((t) => t.includes('Рейтинг востребованности')) && !chartItems.some((t) => t.includes('Реестр лицензий')), 'для графика: рейтинг есть, реестра лицензий нет');
	await page.locator(ITEM, { hasText: 'Рейтинг востребованности' }).first().click();
	await wd.getByText('Вся ширина', { exact: true }).click();
	await wd.getByRole('button', { name: 'Добавить' }).click();
	await page.waitForTimeout(900);
	await page.getByLabel('Готово').click();
	await page.getByRole('button', { name: 'Обновить данные' }).click();
	await page.waitForFunction(() => document.querySelectorAll('article svg').length >= 1, null, { timeout: 90000 }).catch(() => {});
	await page.waitForTimeout(1200);
	check((await page.locator('article svg').count()) > 0, 'график рейтинга нарисован');
	for (const name of ['Заявок', 'Обучающихся', 'Потоков']) check((await page.locator('article').getByText(name, { exact: true }).count()) > 0, `легенда: «${name}»`);
	await page.screenshot({ path: `${out}/demand-widget-1440.png` });
	await page.evaluate(() => localStorage.setItem('rtk.theme', 'rtk_default_dark'));
	await page.reload();
	await page.waitForSelector('article svg', { timeout: 60000 }).catch(() => {});
	await page.waitForTimeout(1200);
	await page.screenshot({ path: `${out}/demand-widget-1440-dark.png` });

	const phone = await newPage(browser, { who: 'admin', width: 390, height: 844 });
	await phone.goto(`${BASE}/reports/dashboards/${dashId}`);
	await phone.getByRole('button', { name: /Обновить данные/ }).click();
	await phone.waitForSelector('article svg', { timeout: 60000 }).catch(() => {});
	await phone.waitForTimeout(1200);
	await phone.screenshot({ path: `${out}/demand-widget-390.png` });
	check(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'телефон 390: нет горизонтальной прокрутки');

	const bad = [...page.__problems.pageerrors, ...page.__problems.console.filter((m) => !m.includes('404'))];
	check(bad.length === 0, `нет ошибок страницы (${bad.join(' | ')})`);
} finally {
	if (dashId) await api('admin', 'DELETE', `/api/dashboards/${dashId}`);
	await browser.close();
}
