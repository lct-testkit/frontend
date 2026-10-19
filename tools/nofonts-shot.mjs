// Кадр без лицензионных шрифтов: /fonts/* блокируется, интерфейс должен остаться sans-serif.
//   APP_URL=http://localhost:5281 node tools/nofonts-shot.mjs --url /login --out dir [--size phone]
import { mkdir } from 'node:fs/promises';
import { BASE, SIZES, newBrowser } from './lib.mjs';

const a = process.argv.slice(2);
const opt = (n, d) => (a.indexOf(`--${n}`) > -1 ? a[a.indexOf(`--${n}`) + 1] : d);
const out = opt('out', '.shots/nofonts');
const [w, h] = SIZES[opt('size', 'desktop')];
await mkdir(out, { recursive: true });
const browser = await newBrowser();
const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
await page.route("**/RostelecomBasis-*", (r) => r.abort());
await page.goto(`${BASE}${opt('url', '/login')}`);
await page.waitForTimeout(1500);
const fam = await page.evaluate(() => [...document.querySelectorAll('h1, button, p, span')].slice(0, 12).map((e) => getComputedStyle(e).fontFamily));
console.log(fam.join('\n'));
await page.screenshot({ path: `${out}/${opt('name', 'nofonts')}.png` });
await browser.close();
