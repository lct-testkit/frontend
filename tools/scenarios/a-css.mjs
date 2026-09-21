import { BASE, newBrowser, newPage } from './a-lib.mjs';
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam' });
await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate((needle) => {
	const found = [];
	for (const sheet of document.styleSheets) { try { for (const rule of sheet.cssRules) { if ((rule.cssText || '').includes(needle)) found.push((rule.cssText || '').slice(0, 160)); } } catch (e) { found.push('ERR ' + e.message); } }
	const styles = [...document.querySelectorAll('style')].filter(s => s.textContent.includes(needle)).map(s => s.textContent.slice(0, 200));
	return { found: found.slice(0, 5), styles: styles.slice(0, 3), bodyClass: document.body.className, bodyVar: getComputedStyle(document.body).getPropertyValue('--atmr-z-index-dropdown'), htmlVar: getComputedStyle(document.documentElement).getPropertyValue('--atmr-z-index-dropdown') };
}, process.argv[2] || '1650'), null, 1));
await browser.close();
