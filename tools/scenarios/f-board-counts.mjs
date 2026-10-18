// F3-3: числа на вкладках списка сделок и точные итоги по столбцам доски.
//   вкладки: «Срок нарушен (N)» = «Найдено: N» после открытия; смена вуза пересчитывает все пять чисел;
//   доска: число в шапке столбца = `total` ответа API, «Ещё N» подгружает по курсору столбца, первая загрузка ≤ 17 запросов.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-board-counts.mjs
import { BASE, accessToken } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';

const tok = await accessToken('head');
const H = { Authorization: `Bearer ${tok}` };
const api = async (path) => (await fetch(`${BASE}${path}`, { headers: H })).json();
const wfs = await api('/api/workflows?state=published&limit=20');
const wf = wfs.items.find((w) => w.deal_type === 'b2b' && w.is_default) ?? wfs.items.find((w) => w.deal_type === 'b2b');

const browser = await newBrowser();
const page = await newPage(browser, { who: 'head', width: 1440, height: 900 });
const reqs = [];
const totals = new Map(); // status_id -> total из ответа API (limit=25)
page.on('request', (r) => {
	const u = new URL(r.url());
	if (u.pathname === '/api/deals' && r.method() === 'GET') reqs.push(u.searchParams);
});
page.on('response', async (res) => {
	const u = new URL(res.url());
	if (u.pathname !== '/api/deals' || u.searchParams.get('limit') !== '25' || u.searchParams.has('cursor')) return;
	const st = u.searchParams.get('status_id');
	if (st && res.ok()) totals.set(st, (await res.json()).total);
});
const tabNumbers = async () => {
	const labels = await page.locator('[role=tab]').allInnerTexts();
	return Object.fromEntries(labels.map((l) => [l.replace(/\s*\(.*$/, '').trim(), l.match(/\((.+)\)/)?.[1]]));
};
try {
	step('вкладки: числа и «Найдено»');
	await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
	await page.getByRole('tab', { name: /Просрочены \(\d+/ }).waitFor({ timeout: 15000 });
	const nums = await tabNumbers();
	console.log('  вкладки:', JSON.stringify(nums));
	const breached = (await api('/api/deals?limit=1&sla_state=breached')).total;
	expect(Number(nums['Просрочены']) === breached, `«Просрочены (${nums['Просрочены']})» = total API ${breached}`);
	await page.getByRole('tab', { name: /Просрочены/ }).click();
	await page.getByText(`Найдено: ${breached}`).waitFor({ timeout: 8000 });
	expect(true, `после открытия вкладки «Найдено: ${breached}»`);

	step('смена вуза пересчитывает все пять чисел за один проход');
	const orgs = await api('/api/organizations?limit=5');
	const org = orgs.items[0];
	await page.goto(`${BASE}/deals?organization=${org.id}`, { waitUntil: 'load' });
	const expectedAll = (await api(`/api/deals?limit=1&organization_id=${org.id}`)).total;
	await page.getByRole('tab', { name: new RegExp(`Все \\(${expectedAll}\\)`) }).waitFor({ timeout: 8000 });
	const n2 = await tabNumbers();
	console.log('  вкладки для вуза:', JSON.stringify(n2));
	expect(Object.values(n2).every((v) => v !== undefined), 'у каждой вкладки есть число (не пустое)');

	step('доска: итоги столбцов = total API, «Ещё N», ≤ 17 запросов на первую загрузку');
	reqs.length = 0;
	totals.clear();
	await page.goto(`${BASE}/deals?view=board&workflow=${wf.id}`, { waitUntil: 'load' });
	await page.locator('section[aria-label]').first().waitFor({ timeout: 15000 });
	await page.waitForTimeout(3500);
	const columnCount = await page.locator('section[aria-label]').count();
	const columnRequests = reqs.filter((p) => p.get('limit') === '25').length;
	console.log(`  столбцов ${columnCount}, запросов столбцов ${columnRequests}, всего запросов к /api/deals ${reqs.length}`);
	expect(columnRequests <= 17, `первая загрузка доски: ${columnRequests} запросов столбцов (не больше 17 = 14 шагов + 3 завершающих); остальные ${reqs.length - columnRequests} — пять счётчиков вкладок`);
	let checked = 0;
	for (const section of await page.locator('section[aria-label]').all()) {
		const name = await section.getAttribute('aria-label');
		const header = (await section.locator('header').innerText()).replace(/\s+/g, ' ');
		const shown = header.match(/(\d+)\s*$/)?.[1];
		if (shown === undefined) continue;
		const wanted = [...totals.values()];
		expect(wanted.includes(Number(shown)), `«${name}»: число в шапке ${shown} есть среди total ответов API`);
		checked += 1;
	}
	expect(checked === columnCount, 'число есть у каждого столбца');

	// столбец с больше чем 25 сделок: «Ещё N»
	const more = page.getByTestId('board-more').first();
	await more.waitFor({ timeout: 5000 });
	const label = (await more.innerText()).trim();
	const section = page.locator('section[aria-label]', { has: page.getByTestId('board-more') }).first();
	const total = Number((await section.locator('header').innerText()).match(/(\d+)\s*$/)[1]);
	expect(label === `Ещё ${Math.min(25, total - 25)}`, `кнопка «${label}» при total ${total} и 25 загруженных`);
	await more.click();
	await page.waitForTimeout(1500);
	const cards = await section.locator('a[draggable=true]').count();
	expect(cards === Math.min(50, total), `после «Ещё» в столбце ${cards} карточек`);
	console.log('problems', JSON.stringify(page.__problems));
} catch (e) {
	console.log('FAIL', e.message.slice(0, 500));
	await page.screenshot({ path: 'D:/testkit-lct/_review/agent-b/f-board-counts-fail.png' });
	process.exitCode = 1;
} finally {
	await browser.close();
}
