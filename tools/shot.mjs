// Screenshots + layout audit of a route at several viewports.
//   node tools/shot.mjs --as kam --url /deals --out .shots/a --sizes all
//   node tools/shot.mjs --as admin --url /workflows --sizes desktop,phone --click "[data-testid=x]" --wait ".table" --theme rtk_default_dark --full
// Options: --guides [--guides-blocks N] (alignment lines + edge numbers) · --hover css (repeatable) · --dpr 2 --clip x,y,w,h (zoom on a detail) · --as kam|head|admin|auditor (omit = anonymous) · --url /path · --out dir · --name label · --sizes all|a,b (see SIZES in lib.mjs
// or WxH like 800x600) · --wait css · --click css (repeatable) · --theme rtk_default_light|rtk_default_dark|… · --full (full-page) · --delay ms
import { mkdir } from 'node:fs/promises';
import { applyGuides, printGuides } from './guides.mjs';
import { ALL_SIZES, BASE, SIZES, auditLayout, newBrowser, newPage } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const all = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));

const who = opt('as', null);
// Git Bash (MSYS) rewrites a leading "/" into "C:/Program Files/Git/…": undo that, and tolerate a missing slash
const url = (() => {
	let u = opt('url', '/').replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, '');
	if (!u.startsWith('/')) u = `/${u}`;
	return u;
})();
const out = opt('out', '.shots');
const name = opt('name', url.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home');
const sizesArg = opt('sizes', 'desktop');
const theme = opt('theme', 'rtk_default_light');
const waitFor = opt('wait', null);
const clicks = all('click');
const hovers = all('hover'); // hover the element before the shot (ring / hover-state checks)
const delay = Number(opt('delay', '600'));
const full = args.includes('--full');
const dpr = Number(opt('dpr', '1'));
const guides = args.includes('--guides'); // alignment lines + numbers (see tools/guides.mjs)
const guideBlocks = Number(opt('guides-blocks', '5'));
const clip = opt('clip', null); // x,y,w,h — a zoomed detail (use with --dpr 2)

const sizes = (sizesArg === 'all' ? ALL_SIZES : sizesArg.split(',')).map((s) => {
	const m = /^(\d+)x(\d+)$/.exec(s);
	if (m) return { label: s, w: Number(m[1]), h: Number(m[2]) };
	if (!SIZES[s]) throw new Error(`unknown size "${s}"`);
	return { label: s, w: SIZES[s][0], h: SIZES[s][1] };
});

await mkdir(out, { recursive: true });
const browser = await newBrowser();
let bad = 0;
try {
	for (const { label, w, h } of sizes) {
		const page = await newPage(browser, { who, width: w, height: h, theme, dpr });
		await page.goto(BASE + url, { waitUntil: 'load' });
		if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => console.log(`  ! selector not found: ${waitFor}`));
		else await page.waitForLoadState('networkidle').catch(() => {});
		for (const sel of clicks) {
			await page.click(sel, { timeout: 8000 }).catch(() => console.log(`  ! click failed: ${sel}`));
			await page.waitForTimeout(350);
		}
		for (const sel of hovers) await page.hover(sel, { timeout: 8000 }).catch(() => console.log(`  ! hover failed: ${sel}`));
		await page.waitForTimeout(delay);
		const guideReport = guides ? await applyGuides(page, { blocks: guideBlocks }) : null;
		const file = `${out}/${name}-${label}-${w}x${h}${theme.endsWith('dark') ? '-dark' : ''}.png`;
		await page.screenshot({ path: file, fullPage: full, clip: clip ? (([x, y, width, height]) => ({ x, y, width, height }))(clip.split(',').map(Number)) : undefined });
		const audit = await auditLayout(page);
		const p = page.__problems;
		const issues = [];
		if (audit.hscroll) issues.push('HORIZONTAL SCROLL');
		if (audit.tableScroll) issues.push('TABLE SCROLL (columns cut off)');
		if (audit.offenders.length) issues.push(`overflow: ${audit.offenders.join('; ')}`);
		if (p.pageerrors.length) issues.push(`page errors: ${p.pageerrors.join(' | ')}`);
		if (p.console.length) issues.push(`console errors: ${[...new Set(p.console)].slice(0, 4).join(' | ')}`);
		if (p.failed.length) issues.push(`failed requests: ${[...new Set(p.failed)].slice(0, 6).join(' | ')}`);
		console.log(`${issues.length ? '✗' : '✓'} ${label} ${w}x${h} → ${file}${issues.length ? '\n    ' + issues.join('\n    ') : ''}`);
		if (guideReport) printGuides(guideReport);
		bad += issues.length ? 1 : 0;
		await page.context().close();
	}
} finally {
	await browser.close();
}
process.exitCode = bad ? 1 : 0;
