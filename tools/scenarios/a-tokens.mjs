import { BASE, newBrowser, newPage } from './a-lib.mjs';
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam' });
await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(() => {
	const out = {};
	for (const sheet of document.styleSheets) { try { for (const rule of sheet.cssRules) { const t = rule.cssText || ''; for (const m of t.matchAll(/--atmr-z-index-[a-z-]+:\s*[^;]+/g)) out[m[0].split(':')[0]] = m[0].split(':')[1].trim(); } } catch { /* a cross-origin sheet cannot be read */ } }
	return out;
})));
await browser.close();
