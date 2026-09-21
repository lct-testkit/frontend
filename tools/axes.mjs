// Left/right axis of EVERY screen: the content frame of each page must start and end on the same lines (the same padding from the side menu).
//   node tools/axes.mjs                       (admin, 1440×900: prints one line per route, flags the ones that differ from the majority)
//   node tools/axes.mjs --as kam --size 1024x768
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

async function walk(dir) {
	const out = [];
	for (const e of await readdir(dir, { withFileTypes: true })) {
		const full = resolve(dir, e.name);
		if (e.isDirectory()) out.push(...(await walk(full)));
		else if (e.name === '+page.svelte') out.push(full);
	}
	return out;
}
const routes = (await walk(resolve(root, 'src/routes/(app)')))
	.map((f) => '/' + relative(resolve(root, 'src/routes/(app)'), dirname(f)).split(sep).join('/'))
	.map((r) => (r === '/.' || r === '/' ? '/' : r))
	.filter((r) => !r.includes('['))
	.sort();

const browser = await newBrowser();
const rows = [];
try {
	const page = await newPage(browser, { who, width: w, height: h });
	// dynamic pages: the first record of the lists that open them
	const extra = [];
	for (const [list, prefix] of [['/deals', '/deals/'], ['/organizations', '/organizations/'], ['/contacts', '/contacts/']]) {
		await page.goto(BASE + list, { waitUntil: 'load' });
		await page.waitForLoadState('networkidle').catch(() => {});
		await page.waitForTimeout(600);
		const href = await page.evaluate((p) => document.querySelector(`a[href^="${p}"]`)?.getAttribute('href') ?? null, prefix);
		if (href) extra.push(href);
	}
	for (const route of [...routes, ...extra]) {
		await page.goto(BASE + route, { waitUntil: 'load' });
		await page.waitForLoadState('networkidle').catch(() => {});
		await page.waitForTimeout(700);
		const axis = await page.evaluate(() => {
			const frame = document.querySelector('main#content')?.firstElementChild;
			if (!frame) return null;
			const r = frame.getBoundingClientRect();
			const cs = getComputedStyle(frame);
			const L = r.left + parseFloat(cs.paddingLeft);
			const R = r.right - parseFloat(cs.paddingRight);
			const top = document.querySelector('header .atmr-top-menu, .atmr-top-menu')?.querySelector('input');
			return { L: Math.round(L * 2) / 2, R: Math.round(R * 2) / 2, url: location.pathname, searchL: top ? Math.round(top.closest('[class*=atmr-input]')?.getBoundingClientRect().left ?? 0) : null };
		});
		rows.push({ route, ...(axis ?? { L: null, R: null }) });
	}
} finally {
	await browser.close();
}

const count = (key) => rows.reduce((m, r) => m.set(r[key], (m.get(r[key]) ?? 0) + 1), new Map());
const modal = (key) => [...count(key)].sort((a, b) => b[1] - a[1])[0]?.[0];
const mL = modal('L');
const mR = modal('R');
let odd = 0;
for (const r of rows) {
	const off = r.L !== mL || r.R !== mR;
	if (off) odd++;
	console.log(`${off ? '✗' : '✓'} ${r.route.padEnd(38)} L=${String(r.L).padStart(6)} R=${String(r.R).padStart(7)}${r.url && r.url !== r.route && !r.route.includes('/', 1) ? ` (→ ${r.url})` : ''}`);
}
console.log(`\nmost screens: L=${mL} R=${mR}; ${odd} of ${rows.length} differ`);
