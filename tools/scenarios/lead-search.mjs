import { BASE, newBrowser, newPage } from '../lib.mjs';
const browser = await newBrowser();
for (const [name, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
	const page = await newPage(browser, { who: 'kam', width: w, height: h });
	await page.goto(BASE + '/');
	await page.waitForSelector('.atmr-side-menu, [data-testid=burger]');
	if (w < 768) await page.getByRole('button', { name: 'Поиск' }).click();
	else await page.keyboard.press('Control+k');
	await page.waitForTimeout(300);
	await page.keyboard.type('университет', { delay: 40 });
	await page.waitForSelector('[role=listbox]', { timeout: 8000 }).catch(() => console.log(name, 'no listbox'));
	await page.waitForTimeout(900);
	const rows = await page.locator('[role=option]').count();
	console.log(name, 'result rows:', rows, '| first:', await page.locator('[role=option]').first().innerText().catch(() => '-'));
	await page.screenshot({ path: `.shots/lead/search-${name}.png` });
	if (rows) {
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(600);
		console.log(name, 'navigated to', new URL(page.url()).pathname);
	}
	console.log(name, 'problems:', JSON.stringify(page.__problems));
	await page.context().close();
}
await browser.close();
