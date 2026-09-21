// Screenshots of the DESIGN SYSTEM's own playground (rt-ui `npm run dev` → http://127.0.0.1:5180) — the reference every block is compared to.
//   node tools/ref-shot.mjs --url /examples/crm --sizes desktop,phone --theme rtk_default_dark --click "[data-testid=add-org]"
// Options: --url path (default /examples/crm) · --sizes all|a,b|WxH · --theme key (added as ?theme=) · --click css (repeatable) · --out dir (.shots/ref) · --name label · --delay ms · --full
import { mkdir } from 'node:fs/promises';
import { ALL_SIZES, SIZES, newBrowser } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const all = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));

const base = process.env.REF_URL || 'http://127.0.0.1:5180';
let path = opt('url', '/examples/crm').replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, '');
if (!path.startsWith('/')) path = `/${path}`;
const theme = opt('theme', 'rtk_default_light');
const out = opt('out', '.shots/ref');
const name = opt('name', path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home');
const delay = Number(opt('delay', '900'));
const clicks = all('click');
const full = args.includes('--full');
const sizes = (opt('sizes', 'desktop') === 'all' ? ALL_SIZES : opt('sizes', 'desktop').split(',')).map((s) => {
	const m = /^(\d+)x(\d+)$/.exec(s);
	if (m) return { label: s, w: Number(m[1]), h: Number(m[2]) };
	if (!SIZES[s]) throw new Error(`unknown size "${s}"`);
	return { label: s, w: SIZES[s][0], h: SIZES[s][1] };
});

await mkdir(out, { recursive: true });
const browser = await newBrowser();
try {
	for (const { label, w, h } of sizes) {
		const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
		const page = await context.newPage();
		const sep = path.includes('?') ? '&' : '?';
		await page.goto(`${base}${path}${sep}theme=${theme}`, { waitUntil: 'load' });
		await page.waitForLoadState('networkidle').catch(() => {});
		for (const sel of clicks) {
			await page.click(sel, { timeout: 8000 }).catch(() => console.log(`  ! click failed: ${sel}`));
			await page.waitForTimeout(400);
		}
		await page.waitForTimeout(delay);
		const file = `${out}/${name}-${label}-${w}x${h}${theme.endsWith('dark') ? '-dark' : ''}.png`;
		await page.screenshot({ path: file, fullPage: full });
		console.log(`✓ ${file}`);
		await context.close();
	}
} finally {
	await browser.close();
}
