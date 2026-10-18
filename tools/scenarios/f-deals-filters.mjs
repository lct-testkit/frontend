// F3-1 / F3-2: фильтры списка сделок в адресной строке: вуз, направление, несколько статусов, колонки «Продукт» и «Направление».
//   APP_URL=http://localhost:5275 node tools/scenarios/f-deals-filters.mjs
import { BASE, accessToken } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';

const tok = await accessToken('head');
const H = { Authorization: `Bearer ${tok}` };
const all = await (await fetch(`${BASE}/api/deals?limit=100`, { headers: H })).json();
// вуз с наибольшим числом сделок и его статусы (минимум два разных)
const byOrg = new Map();
for (const d of all.items) if (d.organization_id) (byOrg.get(d.organization_id) ?? byOrg.set(d.organization_id, []).get(d.organization_id)).push(d);
const [orgId, orgDeals] = [...byOrg.entries()].sort((a, b) => new Set(b[1].map((d) => d.status_id)).size - new Set(a[1].map((d) => d.status_id)).size || b[1].length - a[1].length)[0];
const statuses = [...new Set(orgDeals.map((d) => d.status_id))].slice(0, 2);
const orgName = orgDeals[0].organization_name;
console.log(`вуз: ${orgName}, статусов: ${statuses.length}, сделок вуза: ${orgDeals.length}`);

const browser = await newBrowser();
const page = await newPage(browser, { who: 'head', width: 1440, height: 900 });
const dealRequests = [];
page.on('request', (r) => {
	const u = new URL(r.url());
	if (u.pathname === '/api/deals' && r.method() === 'GET' && u.searchParams.get('limit') === '50') dealRequests.push(u.searchParams);
});
try {
	step('вуз + два статуса из адресной строки');
	await page.goto(`${BASE}/deals?organization=${orgId}&status=${statuses.join(',')}`, { waitUntil: 'load' });
	await page.getByText('Найдено:').waitFor({ timeout: 15000 });
	const last = dealRequests.at(-1);
	expect(last.get('organization_id') === orgId, 'organization_id ушёл в запрос');
	expect(JSON.stringify(last.getAll('status_id').sort()) === JSON.stringify([...statuses].sort()), 'два повторяющихся status_id');
	const expected = orgDeals.filter((d) => statuses.includes(d.status_id)).length;
	await page.getByText(`Найдено: ${expected}`).waitFor({ timeout: 5000 });
	expect(true, `«Найдено: ${expected}» — сделки только этого вуза и этих статусов`);
	const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
	expect(!text.includes('Организация') || text.includes(orgName.slice(0, 12)), 'в таблице название вуза из фильтра');

	step('перезагрузка сохраняет список');
	await page.reload({ waitUntil: 'load' });
	await page.getByText(`Найдено: ${expected}`).waitFor({ timeout: 15000 });
	expect(true, 'после перезагрузки тот же список');

	step('старая ссылка ?status=<uuid>');
	await page.goto(`${BASE}/deals?status=${statuses[0]}`, { waitUntil: 'load' });
	await page.getByText('Найдено:').waitFor({ timeout: 15000 });
	expect(dealRequests.at(-1).getAll('status_id').join() === statuses[0], 'одиночный status работает как раньше');

	step('параметр org открывает форму, а не фильтр');
	await page.goto(`${BASE}/deals?new=1&org=${orgId}`, { waitUntil: 'load' });
	await page.waitForTimeout(1500);
	expect(!dealRequests.at(-1).has('organization_id'), 'org не стал organization_id');

	step('«Сбросить» очищает адрес');
	await page.goto(`${BASE}/deals?organization=${orgId}&status=${statuses.join(',')}`, { waitUntil: 'load' });
	await page.getByTestId('filters-reset').click();
	await page.waitForFunction(() => location.search === '', null, { timeout: 5000 });
	expect(true, 'в адресе нет параметров');

	step('колонки «Продукт» и «Направление»');
	// на 1440 при открытом боковом меню таблице достаётся ~1150 px: «Направление» уходит первой, поэтому проверяем на широком экране
	await page.setViewportSize({ width: 1800, height: 900 });
	await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
	await page.getByText('Найдено:').waitFor({ timeout: 15000 });
	const heads = (await page.locator('.atmr-tablegrid__cell--header').allInnerTexts()).join('|');
	expect(heads.includes('Продукт') && heads.includes('Направление'), `заголовки на 1800: ${heads.replace(/\n/g, ' ')}`);
	await page.setViewportSize({ width: 1024, height: 768 });
	await page.waitForTimeout(500);
	const heads2 = (await page.locator('.atmr-tablegrid__cell--header').allInnerTexts()).join('|');
	expect(!heads2.includes('Направление'), `на 1024 «Направление» ушло первым (остались: ${heads2.replace(/\n/g, ' ')})`);
	console.log('problems', JSON.stringify(page.__problems));
} catch (e) {
	console.log('FAIL', e.message.slice(0, 500));
	await page.screenshot({ path: 'D:/testkit-lct/_review/agent-b/f-deals-filters-fail.png' });
	process.exitCode = 1;
} finally {
	await browser.close();
}
