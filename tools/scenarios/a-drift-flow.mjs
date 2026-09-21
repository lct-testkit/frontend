// Баннер расхождений с ЕГРЮЛ: показ, принятие выбранного поля. (В демо-базе расхождение выставлено вручную — задача сверки идёт раз в сутки.)
import { BASE, accessToken } from '../lib.mjs';
import { newBrowser, newPage, step } from './a-lib.mjs';
const tok = await accessToken('kam');
const org = (await (await fetch(`${BASE}/api/organizations?q=КГТУ&limit=1`, { headers: { Authorization: `Bearer ${tok}` } })).json()).items[0];
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
try {
	await page.goto(`${BASE}/organizations/${org.id}`, { waitUntil: 'load' });
	await page.getByTestId('drift-banner').waitFor({ timeout: 8000 });
	step('баннер: ' + (await page.getByTestId('drift-banner').innerText()).replace(/\n+/g, ' | ').slice(0, 260));
	await page.screenshot({ path: '.shots/a/drift-banner.png' });
	await page.getByTestId('drift-banner').locator('label').first().click();
	await page.getByRole('button', { name: /Принять выбранные/ }).click();
	await page.waitForTimeout(1500);
	const still = await page.getByTestId('drift-banner').count();
	console.log('  баннер остался:', still, '| тосты:', (await page.locator('[class*=notification]').allInnerTexts()).join(' | ').slice(0, 200));
} catch (e) {
	await page.screenshot({ path: '.shots/a/drift-fail.png' });
	console.log('FAIL', e.message.slice(0, 300));
	process.exitCode = 1;
} finally {
	console.log('problems', JSON.stringify(page.__problems));
	await browser.close();
}
