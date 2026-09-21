import { newBrowser, newPage, BASE } from '../lib.mjs';
const browser = await newBrowser();
const page = await newPage(browser, { who: 'admin' });
await page.goto(`${BASE}/admin/erasure/01a0c05b-d2f7-7000-804f-e9d7d72e4578`);
await page.waitForTimeout(1500);
console.log(await page.evaluate(() => {
	const out = [];
	for (const el of document.querySelectorAll('[class*="rounded-l"], [class*="rounded-m"]')) out.push(`${getComputedStyle(el).borderRadius}  <${el.tagName.toLowerCase()} class="${String(el.className).match(/rounded-[a-z]+/)}">`);
	const rules = [];
	for (const s of document.styleSheets) { try { for (const r of s.cssRules) { const walk = (rr) => { for (const x of rr) { if (x.cssRules && !x.selectorText) walk(x.cssRules); else if (x.selectorText === '.rounded-l' || x.selectorText === '.rounded-m') rules.push(x.cssText); } }; walk([r]); } } catch { /* a cross-origin sheet cannot be read */ } }
	return out.slice(0, 8).join('\n') + '\n---\n' + rules.join('\n');
}));
await browser.close();
