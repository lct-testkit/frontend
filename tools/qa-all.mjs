// Layout / console / network audit of every route for every role at several viewports (no screenshots are read — only problems).
//   node tools/qa-all.mjs                       → all roles, sizes: desktop,tablet-p,phone,phone-s,phone-l
//   node tools/qa-all.mjs --as kam,head --sizes desktop,phone --only /deals --shots .shots/qa
// Dynamic routes ([id], [token]) are resolved from the live API (first record); routes that cannot be resolved are listed as skipped.
import { mkdir } from 'node:fs/promises';
import { SIZES, auditLayout, newBrowser, newPage, BASE } from './lib.mjs';
import { routesFor } from './routes.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const roles = opt('as', 'kam,head,admin,auditor').split(',');
const sizeNames = opt('sizes', 'desktop,tablet-p,phone,phone-s,phone-l').split(',');
// Git Bash (MSYS) rewrites a leading "/" into "C:/Program Files/Git/": undo that
const only = opt('only', null)?.replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, '') || null;
const shots = opt('shots', null);
const theme = opt('theme', 'rtk_default_light');

// routes of every role (dynamic segments are resolved from the live API with that role's token)
const plan = {};
const skipped = new Set();
for (const who of roles) {
	const found = await routesFor(who, only);
	plan[who] = found.routes;
	for (const p of found.skipped) skipped.add(p);
}
console.log(`routes: ${Object.values(plan)[0]?.length ?? 0} · roles: ${roles.join(',')} · sizes: ${sizeNames.join(',')}${skipped.size ? `
skipped (no data / no resolver): ${[...skipped].join(', ')}` : ''}
`);

const browser = await newBrowser();
let problems = 0;
let checks = 0;
try {
	for (const who of roles) {
		for (const sizeName of sizeNames) {
			const [w, h] = SIZES[sizeName];
			const page = await newPage(browser, { who, width: w, height: h, theme });
			for (const route of plan[who]) {
				checks++;
				page.__problems = { console: [], pageerrors: [], failed: [] };
				try {
					await page.goto(BASE + route, { waitUntil: 'load' });
					await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
					await page.waitForTimeout(350);
				} catch (e) {
					console.log(`✗ ${who} ${sizeName} ${route} — navigation failed: ${String(e).slice(0, 100)}`);
					problems++;
					continue;
				}
				// a page may still be navigating (a late redirect): wait for it and measure again instead of crashing the whole run
				let audit = null;
				for (let attempt = 0; attempt < 3 && !audit; attempt++) {
					try {
						audit = await auditLayout(page);
					} catch {
						await page.waitForLoadState('load').catch(() => {});
						await page.waitForTimeout(600);
					}
				}
				if (!audit) {
					console.log(`✗ ${who} ${sizeName} ${route} — the page kept navigating, layout not measured`);
					problems++;
					continue;
				}
				const landed = new URL(page.url()).pathname;
				const p = page.__problems;
				const issues = [];
				if (landed !== route.split('?')[0]) issues.push(`redirected → ${landed}`);
				if (audit.hscroll) issues.push('H-SCROLL');
				if (audit.tableScroll) issues.push('TABLE-SCROLL (columns cut off)');
				if (audit.offenders.length) issues.push(`overflow ${audit.offenders.slice(0, 3).join('; ')}`);
				if (p.pageerrors.length) issues.push(`errors: ${p.pageerrors[0]}`);
				const consoleErrors = p.console.filter((c) => !c.includes('Failed to load resource'));
				if (consoleErrors.length) issues.push(`console: ${consoleErrors[0]}`);
				const failed = p.failed.filter((f) => !/^40[13] /.test(f) || route === '/');
				if (failed.length) issues.push(`requests: ${[...new Set(failed)].slice(0, 3).join(', ')}`);
				if (shots) {
					await mkdir(shots, { recursive: true });
					await page.screenshot({ path: `${shots}/${who}-${sizeName}-${route.replace(/[^a-z0-9]+/gi, '_')}.png` });
				}
				if (issues.length) {
					problems++;
					console.log(`✗ ${who.padEnd(7)} ${sizeName.padEnd(8)} ${route}\n    ${issues.join('\n    ')}`);
				}
			}
			await page.context().close();
		}
	}
} finally {
	await browser.close();
}
console.log(`\n${checks} checks, ${problems} with problems`);
process.exitCode = problems ? 1 : 0;
