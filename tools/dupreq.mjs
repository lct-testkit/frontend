// Повторные GET одного и того же адреса за время загрузки страницы (находка QA №14). Печатает адреса, ушедшие больше одного раза.
//   APP_URL=http://localhost:5275 node tools/dupreq.mjs --as admin --urls /deals/<id>,/signing
import { BASE, newBrowser, newPage } from './lib.mjs';
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const who = arg('--as', 'admin');
const urls = arg('--urls', '/').split(',').map((u) => u.replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, ''));
const browser = await newBrowser();
let bad = 0;
for (const url of urls) {
	const page = await newPage(browser, { who });
	const seen = new Map();
	page.on('request', (r) => {
		if (r.method() !== 'GET' || !r.url().includes('/api/')) return;
		const u = new URL(r.url());
		const key = u.pathname + u.search;
		seen.set(key, (seen.get(key) ?? 0) + 1);
	});
	await page.goto(BASE + url, { waitUntil: 'load' });
	await page.waitForTimeout(3500);
	const dup = [...seen].filter(([, n]) => n > 1);
	bad += dup.length;
	console.log(`${dup.length ? '✗' : '✓'} ${url}${dup.map(([k, n]) => `\n    ${n} × ${k}`).join('')}`);
	await page.context().close();
}
await browser.close();
process.exit(bad ? 1 : 0);
