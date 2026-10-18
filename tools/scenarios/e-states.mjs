// Три состояния списочных экранов против живого стенда, ответы подменяются в браузере (page.route): загрузка, пусто, ошибка + «Повторить».
//   APP_URL=http://localhost:5275 node tools/scenarios/e-states.mjs [--only /deals,/tasks]
// Основной запрос списка находится сам: первый GET /api/* на экране, ответ которого содержит массив `items` (или сам массив).
import { BASE, newBrowser, newPage } from '../lib.mjs';

const SCREENS = [
	'/deals', '/organizations', '/contacts', '/tasks', '/notifications', '/signing', '/imports', '/reports/history', '/workflows',
	'/admin/users', '/admin/audit', '/admin/teams', '/admin/approvals', '/admin/erasure', '/admin/edm', '/admin/registry',
	'/admin/notification-templates', '/catalog/products', '/catalog/directions', '/catalog/loss-reasons', '/catalog/holidays'
];
const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
// Git Bash переписывает ведущий /
const only = arg('--only')?.split(',').map((u) => '/' + u.replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, '').replace(/^\/+/, '')) ?? null;
const PROBLEM = JSON.stringify({ type: 'about:blank', title: 'Внутренняя ошибка', status: 500, code: 'CRM-9000' });

process.on('unhandledRejection', () => {}); // запрос в полёте при закрытии страницы
const browser = await newBrowser();
let bad = 0;
const fail = (path, msg) => (bad++, console.log(`✗ ${path}: ${msg}`));

// где имя экрана не совпадает с именем ручки (иначе берётся колокольчик уведомлений)
const OVERRIDE = { '/signing': '/api/me/signature-requests', '/admin/registry': '/api/admin/registry/versions' };

/** какой запрос рисует список: GET /api/* с массивом в ответе; приоритет — путь, оканчивающийся именем экрана, затем самый длинный список */
async function findListUrl(path) {
	if (OVERRIDE[path]) return OVERRIDE[path];
	const page = await newPage(browser, { who: 'admin' });
	const seen = [];
	page.on('response', async (r) => {
		if (r.request().method() !== 'GET' || !r.url().includes('/api/') || !r.ok()) return;
		try {
			const j = await r.json();
			const list = Array.isArray(j) ? j : j?.items;
			if (Array.isArray(list)) seen.push({ api: new URL(r.url()).pathname, n: list.length });
		} catch { /* не JSON */ }
	});
	await page.goto(BASE + path, { waitUntil: 'load' });
	await page.waitForTimeout(2500);
	await page.context().close();
	const name = path.split('/').pop().replace(/s$/, '');
	const own = seen.filter((x) => x.api.split('/').pop().includes(name));
	return ((own.length ? own : seen).sort((p, q) => q.n - p.n)[0] ?? {}).api ?? null;
}

for (const path of SCREENS) {
	if (only && !only.includes(path)) continue;
	const api = await findListUrl(path);
	if (!api) { fail(path, 'не найден запрос списка'); continue; }
	if (process.env.E_DEBUG) console.log(`  ${path} ← ${api}`);
	const matches = (url) => new URL(url).pathname === api;
	const run = async (name, handler, check) => {
		const page = await newPage(browser, { who: 'admin' });
		await page.route((u) => matches(u.href), handler);
		await page.goto(BASE + path, { waitUntil: 'commit' });
		try { await check(page); console.log(`✓ ${path} · ${name}`); } catch (e) { fail(path, `${name}: ${e.message.split('\n')[0]}`); }
		await page.unrouteAll({ behavior: 'ignoreErrors' });
		await page.context().close();
	};
	// а) ответ задержан: через 300 мс виден скелетон или aria-busy
	await run('загрузка', async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); },
		async (page) => { await page.waitForTimeout(300); await page.waitForSelector('.animate-pulse, [aria-busy="true"], .atmr-loader', { timeout: 1500 }); });
	// б) пустой ответ: виден role=status с текстом
	await run('пусто', async (route) => {
		const res = await route.fetch(); const j = await res.json();
		await route.fulfill({ response: res, json: Array.isArray(j) ? [] : { ...j, items: [], next_cursor: null, total: 0 } });
	}, async (page) => { await page.waitForSelector('main [role="status"]', { timeout: 8000 }); });
	// в) ошибка 500: role=alert и «Повторить»; после снятия перехвата и нажатия список появляется
	{
		const page = await newPage(browser, { who: 'admin' });
		let failing = true;
		await page.route((u) => matches(u.href), (route) => (failing ? route.fulfill({ status: 500, contentType: 'application/problem+json', body: PROBLEM }) : route.continue()));
		await page.goto(BASE + path, { waitUntil: 'commit' });
		try {
			await page.waitForSelector('main [role="alert"]', { timeout: 8000 });
			const retry = page.getByRole('button', { name: 'Повторить' }).first();
			await retry.waitFor({ timeout: 3000 });
			failing = false;
			await retry.click();
			await page.waitForSelector('main [role="alert"]', { state: 'detached', timeout: 8000 });
			console.log(`✓ ${path} · ошибка и повтор`);
		} catch (e) { fail(path, `ошибка/повтор: ${e.message.split('\n')[0]}`); }
		await page.context().close();
	}
}
await browser.close();
console.log(bad ? `проблем: ${bad}` : 'все состояния в порядке');
process.exit(bad ? 1 : 0);
