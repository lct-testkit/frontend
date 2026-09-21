// Одиночная смена ответственного (HEAD) на карточке сделки.
import { BASE, accessToken } from '../lib.mjs';
import { choose, expect, field, newBrowser, newPage, step } from './a-lib.mjs';
const tok = await accessToken('head');
const H = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
const org = (await (await fetch(`${BASE}/api/organizations?q=МОУПН&limit=1`, { headers: H })).json()).items[0];
const deal = await (await fetch(`${BASE}/api/deals`, { method: 'POST', headers: { ...H, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ title: 'Программа повышения квалификации для кафедры', deal_type: 'b2b', organization_id: org.id, amount: '150000', currency: 'RUB' }) })).json();
const browser = await newBrowser();
const page = await newPage(browser, { who: 'head', width: 1440, height: 900 });
try {
	step('смена ответственного');
	await page.goto(`${BASE}/deals/${deal.id}`, { waitUntil: 'load' });
	await page.getByTestId('deal-reassign').click();
	await choose(page, 'Новый ответственный', 'Иван Иванов');
	await field(page, 'Причина').fill('Передаю менеджеру по вузам');
	await page.getByRole('button', { name: 'Передать', exact: true }).click();
	await page.waitForTimeout(1500);
	expect((await page.locator('main').innerText()).includes('Иван Иванов'), 'ответственный теперь Иван Иванов');
	await page.getByRole('tab', { name: /История/ }).click();
	await page.waitForTimeout(1200);
	console.log('  события:', (await page.locator('main').innerText()).replace(/\n+/g, ' | ').match(/События.{0,160}/)?.[0]);
} catch (e) {
	await page.screenshot({ path: '.shots/a/reassign-fail.png' });
	console.log('FAIL', e.message.slice(0, 300));
	process.exitCode = 1;
} finally {
	console.log('problems', JSON.stringify(page.__problems));
	await browser.close();
}
