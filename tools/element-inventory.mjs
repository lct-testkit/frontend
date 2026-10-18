// Инвентаризация элементов экрана для проверки «каждый элемент по делу» (ТЗ п. 8.3). Нужен живой стенд, как у tools/axes.mjs.
//   node tools/element-inventory.mjs                 (admin, 1440x900: по строке на экран, дубли по имени отдельно)
//   node tools/element-inventory.mjs --as kam --size 390x844 --json
import { readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, newBrowser, newPage } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const who = opt('as', 'admin');
const [w, h] = opt('size', '1440x900').split('x').map(Number);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = resolve(root, 'src/routes/(app)');

async function walk(dir) {
	const out = [];
	for (const e of await readdir(dir, { withFileTypes: true })) {
		const full = resolve(dir, e.name);
		if (e.isDirectory()) out.push(...(await walk(full)));
		else if (e.name === '+page.svelte') out.push(full);
	}
	return out;
}
const routes = (await walk(appDir))
	.map((f) => '/' + relative(appDir, dirname(f)).split(sep).join('/'))
	.map((r) => (r === '/.' || r === '/' ? '/' : r))
	.filter((r) => !r.includes('['))
	.sort();

// в браузере: видимые интерактивные элементы вне строк таблиц и списков, сгруппированные по имени
function inventory() {
	const names = {};
	let total = 0;
	for (const el of document.querySelectorAll('main#content a[href], main#content button, main#content [role="button"], main#content input, main#content select, main#content textarea')) {
		if (!el.getClientRects().length || el.closest('[aria-hidden="true"]')) continue;
		if (el.closest('tr, [role="row"], li, .atmr-tablegrid__body, .atmr-tablegrid__row')) continue;
		const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
		total++;
		if (name) names[name] = (names[name] ?? 0) + 1;
	}
	const notices = [...document.querySelectorAll('main#content .atmr-inline-notification')].map((n) => n.textContent.replace(/\s+/g, ' ').trim().slice(0, 60));
	return { total, dup: Object.entries(names).filter(([, c]) => c > 1), notices };
}

const browser = await newBrowser();
const rows = [];
try {
	const page = await newPage(browser, { who, width: w, height: h });
	for (const route of routes) {
		try {
			await page.goto(BASE + route, { waitUntil: 'load' });
			await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
			rows.push({ route, ...(await page.evaluate(inventory)) });
		} catch (e) {
			rows.push({ route, error: String(e).split('\n')[0], total: 0, dup: [], notices: [] });
		}
	}
} finally {
	await browser.close();
}

if (args.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else {
	for (const r of rows) {
		console.log(r.route.padEnd(40), r.error ? `ERR ${r.error}` : `элементов: ${String(r.total).padStart(3)}, дублей по имени: ${r.dup.length}, плашек: ${r.notices.length}`);
		for (const [name, count] of r.dup) console.log(`    дубль x${count}: ${name}`);
		for (const n of r.notices) console.log(`    плашка: ${n}`);
	}
}
