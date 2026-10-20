// Предпросмотр числа строк до «Запустить» (R-3): число после паузы, ноль — предупреждение, неверная дата прячет число, сбои и медленный ответ не мешают запуску.
// Нужен бэкенд с POST /api/reports/preview и сделки в демо-данных (tools/seed-demo.mjs).
//   APP_URL=http://localhost:5285 node tools/scenarios/b-reports-preview.mjs
import { BASE, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));

const PREVIEW = '[data-testid="report-preview"]';

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'head', width: 1440, height: 900 });
	const drawer = page.locator('.atmr-drawer');
	const asked = [];
	// тело запроса видно только в обработчике маршрута; шаблон с лишней «*», чтобы не пересекаться с подменами ответов ниже
	await page.route('**/api/reports/preview**', (route) => {
		asked.push(JSON.parse(route.request().postData() ?? '{}'));
		return route.continue();
	});
	const text = async () => ((await drawer.locator(PREVIEW).count()) ? (await drawer.locator(PREVIEW).first().innerText()).replace(/\s+/g, ' ').trim() : null);

	console.log('Число строк после открытия формы');
	await page.goto(`${BASE}/reports`);
	await page.waitForSelector('text=Воронка по статусам');
	await page.getByRole('button', { name: /Сделки по вузам/ }).first().click();
	await page.waitForFunction((sel) => /Найдётся/.test(document.querySelector(sel)?.textContent ?? ''), PREVIEW, { timeout: 8000 });
	const first = await text();
	check(/^Найдётся (≈ )?[\d\s]+ строк/.test(first ?? ''), `под параметрами: «${first}»`);
	check(asked.length === 1 && asked[0].template_code === 'deal_register', `один запрос на открытие (запросов: ${asked.length})`);
	check((await drawer.getByRole('button', { name: 'Запустить' }).count()) === 1, '«Запустить» на месте');

	console.log('Пустой период — предупреждение до запуска');
	const before = asked.length;
	await drawer.locator('input[name="df"]').fill('01.01.2020');
	await drawer.locator('input[name="dt"]').fill('02.01.2020');
	await page.keyboard.press('Tab');
	await page.waitForFunction((sel) => document.querySelector(sel)?.textContent?.includes('строк нет'), PREVIEW, { timeout: 8000 });
	check((await text()) === 'По этим условиям строк нет — расширьте период или уберите фильтры', `ноль: «${await text()}»`);
	const sent = asked[asked.length - 1];
	check(sent.params.date_from === '2020-01-01' && sent.params.date_to === '2020-01-02', `в запросе период ${sent.params.date_from} — ${sent.params.date_to}`);
	check(asked.length - before <= 2, `две правки подряд — не больше двух запросов (${asked.length - before}), а не по запросу на каждый символ`);

	console.log('Дата «по» раньше «с»: число не считаем, пока форма в ошибке');
	const n = asked.length;
	await drawer.locator('input[name="df"]').fill('15.10.2026');
	await drawer.locator('input[name="dt"]').fill('01.10.2026');
	await page.keyboard.press('Tab');
	await page.waitForTimeout(1200);
	const reversed = asked.slice(n).filter((q) => q.params.date_from > q.params.date_to);
	check(reversed.length === 0, 'запроса с перевёрнутым периодом нет');
	await drawer.locator('input[name="df"]').fill('01.10.2026');
	await drawer.locator('input[name="dt"]').fill('20.10.2026');
	await page.keyboard.press('Tab');
	await page.waitForFunction((sel) => /Найдётся/.test(document.querySelector(sel)?.textContent ?? '') && !document.querySelector(sel).className.includes('opacity-60'), PREVIEW, { timeout: 8000 });
	check(/^Найдётся 50 строк/.test((await text()) ?? ''), `период 01.10 — 20.10 после нуля: «${await text()}»`);

	console.log('Сбои не ломают форму');
	await page.route('**/api/reports/preview', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"title":"boom","status":500}' }));
	await drawer.locator('input[name="dt"]').fill('19.10.2026');
	await page.keyboard.press('Tab');
	await page.waitForTimeout(1500);
	check((await text()) === null, '500: строки с числом нет, ошибки на экране нет');
	check((await drawer.locator('[role="alert"]').count()) === 0, '500: красных сообщений в панели нет');
	await page.unroute('**/api/reports/preview');

	await page.route('**/api/reports/preview', (route) => route.fulfill({ status: 429, headers: { 'retry-after': '3' }, contentType: 'application/json', body: '{"title":"many","status":429}' }));
	await drawer.locator('input[name="dt"]').fill('18.10.2026');
	await page.keyboard.press('Tab');
	await page.waitForTimeout(1500);
	check((await text()) === null, '429: строки с числом нет');
	await page.unroute('**/api/reports/preview');

	await page.route('**/api/reports/preview', (route) => route.abort());
	await drawer.locator('input[name="dt"]').fill('17.10.2026');
	await page.keyboard.press('Tab');
	await page.waitForTimeout(1500);
	check((await text()) === null, 'обрыв связи: строки с числом нет');
	await page.unroute('**/api/reports/preview');

	console.log('Медленный ответ: форма живая, число приглушено');
	await page.waitForTimeout(3500); // после 429 ждём Retry-After
	await drawer.locator('input[name="dt"]').fill('16.10.2026');
	await page.keyboard.press('Tab');
	await page.waitForSelector(PREVIEW, { timeout: 8000 });
	let release;
	const gate = new Promise((r) => (release = r));
	await page.route('**/api/reports/preview', async (route) => {
		await gate;
		await route.continue();
	});
	await drawer.locator('input[name="dt"]').fill('15.10.2026');
	await page.keyboard.press('Tab');
	await page.waitForTimeout(900);
	check(/opacity-60/.test((await drawer.locator(PREVIEW).first().getAttribute('class')) ?? ''), 'пока считается новое, прошлое число приглушено');
	const run = drawer.getByRole('button', { name: 'Запустить' });
	check(await run.isEnabled(), '«Запустить» доступна, пока число считается');
	release();
	await page.waitForTimeout(800);
	await page.unroute('**/api/reports/preview');

	console.log('Запуск после сбоев работает');
	await run.click();
	await page.waitForSelector('text=Отчёт готов', { timeout: 30000 });
	ok('отчёт сформирован');
} catch (e) {
	fail(`сценарий упал: ${e.message}`);
} finally {
	await browser.close();
}
