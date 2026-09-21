import { BASE, newBrowser, newPage } from './a-lib.mjs';
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
await page.goto(`${BASE}/deals?new=1`, { waitUntil: 'load' });
await page.waitForTimeout(1000);
await page.locator('.atmr-input:has(.atmr-input__label span:text-is("Организация")) input').first().click();
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(() => {
	const z = (el) => el ? { cls: String(el.className).slice(0, 60), z: getComputedStyle(el).zIndex, pos: getComputedStyle(el).position, parent: el.parentElement?.tagName + '.' + String(el.parentElement?.className).slice(0, 40) } : null;
	const menus = [...document.querySelectorAll('.atmr-dropdown-menu, [class*=dropdown-menu]')].slice(0, 4).map(z);
	return { drawer: z(document.querySelector('.atmr-drawer')), overlay: z(document.querySelector('.atmr-drawer__overlay')), content: z(document.querySelector('.atmr-drawer__content')), menus, tokens: getComputedStyle(document.body).getPropertyValue('--atmr-z-index-dropdown') + '|' + getComputedStyle(document.body).getPropertyValue('--atmr-z-index-modal') + '|' + getComputedStyle(document.body).getPropertyValue('--atmr-z-index-drawer') };
}), null, 1));
await page.screenshot({ path: '.shots/a/menu-open.png' });
await browser.close();
