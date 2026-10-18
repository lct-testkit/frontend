// Лимит отчётов и очередь (F1-14): 429 CRM-1601 с автоактивацией «Повторить», очередь «В очереди» → «Формируем…» → «Готов» со «Свернуть» и тостом, 410 при скачивании.
// Ответы сервера подменяются через page.route (на стенде нельзя набрать 10 незавершённых отчётов и состарить файл); основа — настоящее задание из истории.
//   node tools/scenarios/b-reports-limits.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const json = (route, status, body) => route.fulfill({ status, contentType: status >= 400 ? 'application/problem+json' : 'application/json', body: JSON.stringify(body) });
const isReports = (u) => new URL(u).pathname === '/api/reports';

const token = await accessToken('admin');
const real = (await (await fetch(`${BASE}/api/reports?limit=100`, { headers: { Authorization: `Bearer ${token}` } })).json()).items.find((j) => j.status === 'completed' && j.template_code === 'deal_funnel');
if (!real) {
	fail('в истории администратора нет готового «Воронка по статусам» — запустите b-reports.mjs');
	process.exit(1);
}

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	const drawer = page.locator('.atmr-drawer');
	const open = async () => {
		await page.goto(`${BASE}/reports`);
		await page.getByRole('button', { name: /Воронка по статусам/ }).click();
		await page.waitForTimeout(500);
	};

	console.log('429 CRM-1601: заголовок, текст сервера, «Повторить» включается сама');
	let busy = 10;
	await page.route('**/api/reports**', (route) => {
		const req = route.request();
		if (!isReports(req.url())) return route.fallback();
		if (req.method() === 'POST') return json(route, 429, { type: 'about:blank', title: 'Слишком много отчётов', status: 429, code: 'CRM-1601', detail: 'Не завершено отчётов: 10 (лимит 10). Дождитесь завершения.' });
		if (req.method() === 'GET') return json(route, 200, { items: Array.from({ length: busy }, (_, i) => ({ ...real, id: `00000000-0000-7000-8000-${String(i).padStart(12, '0')}`, status: 'processing' })), next_cursor: null });
		return route.fallback();
	});
	await open();
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await page.waitForSelector('text=Слишком много отчётов в работе');
	check((await drawer.getByText('Не завершено отчётов: 10 (лимит 10)').count()) > 0, 'текст сервера с числами показан');
	await page.waitForSelector('text=В работе у вас: 10 из 10');
	const retry = drawer.getByRole('button', { name: 'Повторить' });
	check(await retry.isDisabled(), '«Повторить» выключена, пока слотов нет');
	busy = 9;
	await page.waitForFunction(() => [...document.querySelectorAll('.atmr-drawer button')].some((b) => b.textContent?.trim() === 'Повторить' && !b.disabled), null, { timeout: 15000 }).then(
		() => ok('«Повторить» включилась сама, когда в работе осталось 9'),
		() => fail('«Повторить» не включилась после освобождения слота')
	);
	await page.screenshot({ path: '.shots/b-limits/limit-1440.png' });
	await page.unrouteAll({ behavior: 'ignoreErrors' });

	console.log('Очередь: «В очереди» → «Формируем…» → «Готов», «Свернуть» и тост');
	const fake = { ...real, id: '00000000-0000-7000-8000-00000000f114', status: 'queued', file_id: null };
	let polls = 0;
	await page.route('**/api/reports**', (route) => {
		const req = route.request();
		const path = new URL(req.url()).pathname;
		if (isReports(req.url()) && req.method() === 'POST') return json(route, 202, fake);
		if (path === `/api/reports/${fake.id}`) {
			polls += 1;
			return json(route, 200, polls < 3 ? { ...fake, status: 'queued' } : polls < 5 ? { ...fake, status: 'processing' } : { ...real, id: fake.id, status: 'completed' });
		}
		return route.fallback();
	});
	await open();
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await page.waitForSelector('text=В очереди');
	check((await drawer.getByText('раз в минуту').count()) > 0, 'в очереди: пояснение про минуту');
	check((await drawer.getByRole('button', { name: 'Свернуть' }).count()) === 1, 'есть кнопка «Свернуть»');
	await page.screenshot({ path: '.shots/b-limits/queue-1440.png' });
	await page.waitForSelector('text=Формируем отчёт', { timeout: 15000 });
	ok('статус сменился на «Формируем отчёт…»');
	await page.waitForSelector('text=Отчёт готов', { timeout: 20000 });
	ok('«Отчёт готов»');
	await page.unrouteAll({ behavior: 'ignoreErrors' });

	polls = 0;
	await page.route('**/api/reports**', (route) => {
		const req = route.request();
		const path = new URL(req.url()).pathname;
		if (isReports(req.url()) && req.method() === 'POST') return json(route, 202, fake);
		if (path === `/api/reports/${fake.id}`) {
			polls += 1;
			return json(route, 200, polls < 3 ? { ...fake, status: 'processing' } : { ...real, id: fake.id, status: 'completed' });
		}
		return route.fallback();
	});
	await open();
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await drawer.getByRole('button', { name: 'Свернуть' }).click();
	await page.waitForSelector('text=Отчёт «Воронка по статусам» готов', { timeout: 20000 });
	ok('после «Свернуть» о готовности сказал тост');
	await page.unrouteAll({ behavior: 'ignoreErrors' });

	console.log('410: файл удалён');
	await page.route('**/api/reports**', (route) => {
		const req = route.request();
		const path = new URL(req.url()).pathname;
		if (path === `/api/reports/${real.id}/download`) return json(route, 410, { type: 'about:blank', title: 'Файл удалён', status: 410, code: 'CRM-1603', detail: 'Срок хранения файла истёк' });
		if (isReports(req.url()) && req.method() === 'GET') return json(route, 200, { items: [{ ...real, expires_at: new Date(Date.now() + 86_400_000).toISOString() }], next_cursor: null });
		return route.fallback();
	});
	await page.goto(`${BASE}/reports/history`);
	await page.waitForSelector('text=Воронка по статусам');
	await page.getByLabel('Скачать', { exact: true }).first().click();
	await page.waitForSelector('text=Файла уже нет');
	ok('тост «Файла уже нет» вместо красной ошибки');
	await page.waitForSelector('text=Файл недоступен');
	check((await page.getByLabel('Запустить заново').count()) > 0, 'строка «Файл недоступен» и кнопка «Запустить заново»');
	await page.screenshot({ path: '.shots/b-limits/gone-1440.png' });

	const p = page.__problems;
	check(p.pageerrors.length === 0, 'нет исключений на странице');
} finally {
	await browser.close();
}
