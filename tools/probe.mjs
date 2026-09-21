// Evaluate JS in a page and print the result: node tools/probe.mjs --as kam --url /contacts --js "document.title" [--size 1440x900] [--click css] [--delay ms]
import { BASE, newBrowser, newPage } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const who = opt('as', null);
let url = opt('url', '/').replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, '');
if (!url.startsWith('/')) url = `/${url}`;
const [w, h] = opt('size', '1440x900').split('x').map(Number);
const js = opt('js', 'document.title');
const clicks = args.flatMap((a, i) => (a === '--click' ? [args[i + 1]] : []));
const theme = opt('theme', 'rtk_default_light');
const browser = await newBrowser();
try {
	const page = await newPage(browser, { who, width: w, height: h, theme });
	await page.goto(BASE + url, { waitUntil: 'load' });
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(Number(opt('delay', '800')));
	for (const sel of clicks) {
		await page.click(sel, { timeout: 8000 }).catch(() => console.log(`! click failed: ${sel}`));
		await page.waitForTimeout(400);
	}
	const result = await page.evaluate(js);
	console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
} finally {
	await browser.close();
}
