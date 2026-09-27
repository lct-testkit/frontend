// Fresh screenshots for the READMEs (docs/img/crm-*.png) taken from the running dev client, so the pictures always show the real screens.
//   node tools/readme-shots.mjs                       all pictures → docs/img
//   node tools/readme-shots.mjs --only deals,phone    only the pictures whose name contains one of the words
//   node tools/readme-shots.mjs --out .shots/readme   another folder
// Needs the client on APP_URL (default http://localhost:5273) with the demo data (tools/seed-demo.mjs). The bitrix/* pictures are real evidence from a
// portal and are NOT generated here.
import { mkdir, readFile, rm } from 'node:fs/promises';
import { BASE, SIZES, accessToken, newBrowser, newPage } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const out = opt('out', 'docs/img');
const only = opt('only', '').split(',').filter(Boolean);
const want = (name) => !only.length || only.some((o) => name.includes(o));
await mkdir(out, { recursive: true });

const token = await accessToken('admin');
const api = async (path) => (await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } })).json();
const items = (j) => (Array.isArray(j) ? j : j.items) ?? [];
const workflows = items(await api('/api/workflows?limit=50'));
const b2c = workflows.find((w) => w.code === 'b2c_individual_v1') ?? workflows[0];
const deals = items(await api('/api/deals?limit=20'));
const deal = deals.find((d) => d.owner_id) ?? deals[0];

const browser = await newBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** one shot: role, route, viewport, theme, what to do before the picture */
async function shot(name, { who, url, size = 'desktop', theme = 'rtk_default_light', before, delay = 900 }) {
	if (!want(name)) return null;
	const [width, height] = Array.isArray(size) ? size : SIZES[size];
	const page = await newPage(browser, { who, width, height, theme });
	await page.goto(BASE + url, { waitUntil: 'load' });
	await page.waitForLoadState('networkidle').catch(() => {});
	await wait(500);
	if (before) await before(page);
	await wait(delay);
	const file = `${out}/${name}.png`;
	await page.screenshot({ path: file });
	await page.context().close();
	console.log('✓', file);
	return file;
}

await shot('crm-home-light', { who: 'kam', url: '/' });
await shot('crm-deals-light', { who: 'kam', url: '/deals' });
await shot('crm-board-light', { who: 'kam', url: '/deals', before: (p) => p.getByText('Доска', { exact: true }).first().click() });
await shot('crm-deal-dark', { who: 'kam', url: `/deals/${deal.id}`, theme: 'rtk_default_dark' });
await shot('crm-org-form', { who: 'kam', url: '/organizations', before: async (p) => {
		await p.getByTestId('new-org').first().click();
		await p.getByPlaceholder(/Например/).fill('7707049388');
		await wait(1800);
	}
});
await shot('crm-workflow', {
	who: 'admin',
	url: `/workflows/${b2c.id}`,
	delay: 1200,
	before: async (p) => {
		await wait(1200);
		await p.locator('.svelte-flow__controls-fitview').first().click();
	}
});
await shot('crm-signing', { who: 'admin', url: `/deals/${deal.id}?tab=signing`, before: (p) => p.getByTestId('open-send-wizard').first().click() });
await shot('crm-audit', { who: 'admin', url: '/admin/audit?action=DEAL_STATUS_CHANGED' });
await shot('crm-erasure', { who: 'admin', url: '/admin/erasure' });
await shot('crm-imports', { who: 'admin', url: '/imports/new' });
await shot('crm-reports', { who: 'admin', url: '/reports' });
await shot('crm-login', { url: '/login' });
await shot('crm-verify', { url: '/verify' });
await shot('crm-phone-light', { who: 'kam', url: '/deals', size: 'phone' });
await shot('crm-phone-dark', { who: 'kam', url: '/deals', size: 'phone', theme: 'rtk_default_dark' });

// «Сделки» in the four themes, 2×2
if (want('themes')) {
	const themes = ['rtk_default_light', 'rtk_default_dark', 'rtk_purple_light', 'rtk_purple_dark'];
	const tiles = [];
	for (const theme of themes) {
		const page = await newPage(browser, { who: 'kam', width: 1440, height: 900, theme });
		await page.goto(BASE + '/deals', { waitUntil: 'load' });
		await page.waitForLoadState('networkidle').catch(() => {});
		await wait(900);
		const file = `${out}/.tile-${theme}.png`;
		await page.screenshot({ path: file });
		await page.context().close();
		tiles.push(file);
	}
	await sheet(`${out}/crm-themes.png`, tiles, { cols: 2, tileWidth: 700, gap: 8 });
}

// «Сделки» on four window sizes in a row
if (want('tools')) {
	const sizes = ['desktop', 'tablet-l', 'tablet-p', 'phone'];
	const tiles = [];
	for (const s of sizes) {
		const [width, height] = SIZES[s];
		const page = await newPage(browser, { who: 'kam', width, height, theme: 'rtk_default_light' });
		await page.goto(BASE + '/deals', { waitUntil: 'load' });
		await page.waitForLoadState('networkidle').catch(() => {});
		await wait(900);
		const file = `${out}/.tile-size-${s}.png`;
		await page.screenshot({ path: file });
		await page.context().close();
		tiles.push(file);
	}
	await sheet(`${out}/crm-tools.png`, tiles, { cols: 4, tileHeight: 480, gap: 8 });
}

/** tiles → one picture (rendered by the browser itself, no extra dependencies) */
async function sheet(file, tiles, { cols, tileWidth, tileHeight, gap }) {
	const datas = await Promise.all(tiles.map(async (f) => (await readFile(f)).toString('base64')));
	const style = tileWidth ? `width:${tileWidth}px` : `height:${tileHeight}px`;
	const html = `<body style="margin:0;background:#d9d9de;display:grid;grid-template-columns:repeat(${cols},max-content);gap:${gap}px;padding:${gap}px;width:max-content">${datas
		.map((d) => `<img src="data:image/png;base64,${d}" style="${style};display:block;border-radius:6px">`)
		.join('')}</body>`;
	const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
	await page.setContent(html);
	await wait(300);
	await page.locator('body').screenshot({ path: file });
	await page.context().close();
	await Promise.all(tiles.map((f) => rm(f, { force: true })));
	console.log('✓', file);
}

await browser.close();
