// The FIRST ROW of every screen must stand on the same line under the top bar (docs/REBUILD-PLAN.md §9.2): one row, 36 px (48 px on a phone), its
// centre 42 px under the bar on a desktop (34 on a tablet, 36 on a phone). The tool takes a screenshot of the strip under the bar and measures what is
// PAINTED: the first painted row ("first painted") and the centre of the first cluster of painted rows ("first row: centre"). Text is painted about 1.5 px
// above the centre of its line, so ±2 px counts as the same line; a page that starts with a box (card, table) on the padding line counts too.
//   node tools/tops.mjs                         (admin, 1440×900)   ·   node tools/tops.mjs --size 390x844 --as kam --theme rtk_default_dark
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
const theme = opt('theme', 'rtk_default_light');
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
	// dpr 2: the pixels of the screenshot are half-pixels of the page
		const page = await newPage(browser, { who, width: w, height: h, theme, dpr: 2 });
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
		const res = await page.evaluate(() => {
			const main = document.querySelector('main#content');
			const frame = main?.firstElementChild;
			if (!frame) return null;
			const bar = document.querySelector('.atmr-top-menu')?.getBoundingClientRect().bottom ?? 56;
			const visible = (el) => {
				const cs = getComputedStyle(el);
				if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
				for (let p = el; p && p !== document.body; p = p.parentElement) {
					if (p.classList?.contains('sr-only') || getComputedStyle(p).position === 'fixed') return false;
				}
				return true;
			};
			let best = { top: Infinity, what: '' };
			const consider = (top, what) => {
				if (top < best.top) best = { top, what };
			};
			// boxes of controls
			for (const el of frame.querySelectorAll('button, input, select, textarea, .atmr-badge, .atmr-input, .atmr-button, [role=tab], .atmr-tablegrid, section, ul.list-none')) {
				if (!visible(el)) continue;
				const r = el.getBoundingClientRect();
				if (r.width < 4 || r.height < 4) continue;
				consider(r.top, el.tagName.toLowerCase() + (typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));
			}
			// lines of text
			const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				if (!n.textContent.trim() || !n.parentElement || !visible(n.parentElement)) continue;
				const range = document.createRange();
				range.selectNodeContents(n);
				const rect = range.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0) consider(rect.top, 'text «' + n.textContent.trim().slice(0, 18) + '»');
			}
			const fr = frame.getBoundingClientRect();
			const fcs = getComputedStyle(frame);
			return { bar: Math.round(bar), left: Math.round(fr.left + parseFloat(fcs.paddingLeft)), right: Math.round(fr.right - parseFloat(fcs.paddingRight)), block: Math.round(frame.firstElementChild ? frame.getBoundingClientRect().top + parseFloat(getComputedStyle(frame).paddingTop) : 0), first: Math.round(best.top * 2) / 2, what: best.what };
		});
		let ink;
		if (res) {
			const clip = { x: res.left, y: res.bar + 1, width: Math.max(10, res.right - res.left), height: 200 };
			const png = await page.screenshot({ clip });
			ink = await page.evaluate(async (b64) => {
				const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
				const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
				const cv = document.createElement('canvas');
				cv.width = bmp.width;
				cv.height = bmp.height;
				const ctx = cv.getContext('2d');
				ctx.drawImage(bmp, 0, 0);
				const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
				const bg = [d[0], d[1], d[2]];
				const painted = (y) => {
					for (let x = 0; x < cv.width; x++) {
						const i = (y * cv.width + x) * 4;
						if (Math.abs(d[i] - bg[0]) > 10 || Math.abs(d[i + 1] - bg[1]) > 10 || Math.abs(d[i + 2] - bg[2]) > 10) return true;
					}
					return false;
				};
				let y0 = -1;
				for (let y = 0; y < cv.height; y++) if (painted(y)) { y0 = y; break; }
				if (y0 < 0) return { first: -1, centre: -1 };
				// the first row = the painted rows up to the first gap of 3 px or more
				let y1 = y0;
				let gap = 0;
				for (let y = y0; y < cv.height; y++) {
					if (painted(y)) { y1 = y; gap = 0; } else if (++gap >= 6) break;
				}
				return { first: y0 / 2 + 0.5, centre: (y0 + y1 + 1) / 4 + 0.5, height: (y1 - y0 + 1) / 2 };
			}, png.toString('base64'));
		}
		rows.push({ route, ink: ink?.first, centre: ink?.centre, height: ink?.height, ...(res ?? {}) });
	}
} finally {
	await browser.close();
}

const gaps = rows.map((r) => (r.centre === undefined ? null : r.centre));
const freq = new Map();
for (const g of gaps) if (g !== null) freq.set(Math.round(g), (freq.get(Math.round(g)) ?? 0) + 1);
const modal = [...freq].sort((a, b) => b[1] - a[1])[0]?.[0];
rows.forEach((r, i) => {
	const gap = gaps[i];
	// ok = the row centre is on the common line (±2 px: the ink of text sits about 1.5 px above the centre of its line), or the page starts with a BOX (card, table) on the padding line
	const padding = (r.block ?? 0) - (r.bar ?? 0);
	const ok = gap !== null && (Math.abs(gap - modal) <= 2 || Math.abs((r.ink ?? 0) - padding) <= 1);
	console.log(`${ok ? '✓' : '✗'} ${r.route.padEnd(36)} first painted ${String(r.ink).padStart(5)}  ·  first row: centre ${String(gap).padStart(5)}  height ${String(r.height).padStart(5)}   (${r.what ?? ''})`);
});
console.log(`\nmost common centre of the first row: ${modal} px under the bar; differ by more than 1 px: ${gaps.filter((g) => g === null || Math.abs(g - modal) > 1).length} of ${rows.length}`);
