// Contact sheet: tiles screenshots of a folder into one image, so a whole set can be read at a glance.
//   (--names a,b picks the files that start with «a-», «b-»)
//   node tools/sheet.mjs --dir ../frontend-shots/forms --match desktop-light --from 0 --count 6 --cols 2 --width 860 --out ../frontend-shots/sheet-1.png
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { newBrowser } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const dir = resolve(opt('dir', '../frontend-shots/forms'));
const match = opt('match', '');
const from = Number(opt('from', 0));
const count = Number(opt('count', 6));
const cols = Number(opt('cols', 2));
const width = Number(opt('width', 860));
const out = resolve(opt('out', '../frontend-shots/sheet.png'));
const names = opt('names', '').split(',').filter(Boolean);

const files = (await readdir(dir)).filter((f) => f.endsWith('.png') && f.includes(match) && (!names.length || names.some((n) => f.startsWith(n + '-')))).sort().slice(from, from + count);
const tiles = await Promise.all(files.map(async (f) => [f, (await readFile(resolve(dir, f))).toString('base64')]));
const html = `<body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(${cols}, ${width}px);gap:6px;padding:6px;font:12px sans-serif">${tiles
	.map(([f, data]) => `<figure style="margin:0;background:#fff"><figcaption style="padding:2px 6px;background:#222;color:#fff">${f}</figcaption><img src="data:image/png;base64,${data}" style="width:${width}px;display:block"></figure>`)
	.join('')}</body>`;
const browser = await newBrowser();
try {
	const page = await browser.newPage({ viewport: { width: cols * (width + 6) + 6, height: 800 } });
	await page.setContent(html);
	await page.waitForFunction(() => [...document.images].every((i) => i.complete));
	await page.screenshot({ path: out, fullPage: true });
	console.log(files.length, 'files →', out);
} finally {
	await browser.close();
}
