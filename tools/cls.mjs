// Cumulative Layout Shift (PerformanceObserver 'layout-shift', без сдвигов от ввода) на загрузке и при переключениях. Цель ≤ 0.1.
//   APP_URL=http://localhost:5275 node tools/cls.mjs [--only home,deals,deal,board,org,dash] [--sizes phone,phone-s] [--as admin|kam]
// Источники сдвигов печатаются (элемент, значение), чтобы было видно, что чинить.
import { BASE, SIZES, newBrowser, newPage } from './lib.mjs';
import { routesFor } from './routes.mjs';

const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const only = arg('--only')?.split(',') ?? null;
const sizes = (arg('--sizes') ?? 'desktop,phone,phone-s').split(',');
const { routes } = await routesFor('admin');
const deal = routes.find((r) => /^\/deals\/[0-9a-f-]{20,}/.test(r));
const org = routes.find((r) => /^\/organizations\/[0-9a-f-]{20,}/.test(r));
const dash = routes.find((r) => /^\/reports\/dashboards\/[0-9a-f-]{20,}/.test(r));

const OBSERVE = () => {
	window.__cls = { total: 0, items: [] };
	new PerformanceObserver((list) => {
		for (const e of list.getEntries()) {
			if (e.hadRecentInput) continue;
			window.__cls.total += e.value;
			window.__cls.items.push({ v: +e.value.toFixed(3), at: Math.round(e.startTime), nodes: e.sources.map((s) => { const n = s.node; const r = (x) => `${Math.round(x.x)},${Math.round(x.y)} ${Math.round(x.width)}x${Math.round(x.height)}`; return (n ? `${n.tagName?.toLowerCase()}.${[...(n.classList ?? [])].slice(0, 2).join('.')}` : '?') + ` [${r(s.previousRect)} → ${r(s.currentRect)}]`; }).slice(0, 2) });
		}
	}).observe({ type: 'layout-shift', buffered: true });
};

const who = arg('--as') ?? 'admin';
const SCENARIOS = {
	home: { path: '/', steps: async () => {} },
	deals: { path: '/deals', steps: async () => {} },
	deal: { path: deal, steps: async () => {} },
	org: { path: org, steps: async () => {} },
	board: { path: '/deals', steps: async (p) => { await p.waitForTimeout(1500); await p.evaluate(() => (window.__cls = { total: 0, items: [] }, 0)); await p.getByRole('button', { name: /Доска/ }).first().click({ timeout: 4000 }).catch(() => p.getByText('Доска').first().click({ timeout: 4000 })).catch(() => {}); await p.waitForTimeout(2500); } },
	dash: { path: dash, steps: async (p) => { await p.waitForTimeout(1500); await p.evaluate(() => (window.__cls = { total: 0, items: [] }, 0)); await p.getByRole('button', { name: /Обновить данные/ }).first().click(); await p.waitForTimeout(3000); } }
};

const browser = await newBrowser();
let bad = 0;
for (const size of sizes) {
	const [width, height] = SIZES[size];
	for (const [name, sc] of Object.entries(SCENARIOS)) {
		if (only && !only.includes(name)) continue;
		const page = await newPage(browser, { who, width, height });
		await page.addInitScript(OBSERVE);
		await page.goto(BASE + sc.path, { waitUntil: 'load' });
		await page.waitForTimeout(2500);
		await sc.steps(page);
		const r = await page.evaluate(() => window.__cls);
		const flag = r.total > 0.1 ? '✗' : '✓';
		if (r.total > 0.1) bad++;
		console.log(`${flag} ${name.padEnd(6)} ${size.padEnd(8)} CLS ${r.total.toFixed(3)}  ${r.items.filter((i) => i.v >= 0.01).map((i) => `${i.v}@${i.at}ms ${i.nodes.join('+')}`).join(' | ')}`);
		await page.context().close();
	}
}
await browser.close();
process.exit(bad ? 1 : 0);
