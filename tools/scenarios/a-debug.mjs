// Отладка вёрстки: node tools/scenarios/a-debug.mjs <who> <url> <width> <height> "<js expression returning JSON>"
import { BASE, newBrowser, newPage } from '../lib.mjs';
const [who, url, w, h, expr] = process.argv.slice(2);
const browser = await newBrowser();
const page = await newPage(browser, { who: who === 'none' ? null : who, width: Number(w), height: Number(h) });
await page.goto(BASE + url, { waitUntil: 'load' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
console.log('problems', JSON.stringify(page.__problems));
await browser.close();
