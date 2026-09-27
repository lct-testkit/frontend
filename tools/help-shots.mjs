// Pictures of the in-app help (static/help/*.png, 900 px wide) taken from the running dev client with the demo data.
//   node tools/help-shots.mjs                     all pictures
//   node tools/help-shots.mjs --only login,deal   only the pictures whose name contains one of the words
// The public signing picture (signing-otp.png) and the outbox tab (integrations-outbox.png) need a live signature request / delivered events and are not
// generated here.
import { mkdir } from 'node:fs/promises';
import { BASE, accessToken, newBrowser, newPage } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const out = opt('out', 'static/help');
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await newBrowser();

/** a cut of the 1440×900 screen, saved 900 px wide */
async function shot(name, { who, url, clip, before }) {
	if (!want(name)) return;
	const page = await newPage(browser, { who, width: 1440, height: 900, theme: 'rtk_default_light', dpr: 900 / clip.width });
	await page.goto(BASE + url, { waitUntil: 'load' });
	await page.waitForLoadState('networkidle').catch(() => {});
	await wait(600);
	if (before) await before(page);
	await wait(900);
	await page.screenshot({ path: `${out}/${name}.png`, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height } });
	await page.context().close();
	console.log('✓', `${out}/${name}.png`);
}

await shot('login', { url: '/login', clip: { x: 0, y: 0, width: 1440, height: 900 } });
await shot('deal-card', { who: 'kam', url: `/deals/${deal.id}`, clip: { x: 270, y: 70, width: 1140, height: 565 } });
await shot('import-wizard', { who: 'admin', url: '/imports/new', clip: { x: 270, y: 70, width: 870, height: 546 } });
await shot('org-lookup', {
	who: 'kam',
	url: '/organizations',
	clip: { x: 865, y: 0, width: 560, height: 251 },
	before: async (p) => {
		await p.getByTestId('new-org').first().click();
		await p.getByPlaceholder(/Например/).fill('7729012342');
		await wait(1800);
	}
});
await shot('teams', { who: 'admin', url: '/admin/teams', clip: { x: 270, y: 70, width: 1140, height: 253 } });
await shot('workflow-graph', {
	who: 'admin',
	url: `/workflows/${b2c.id}`,
	clip: { x: 270, y: 70, width: 1140, height: 712 },
	before: async (p) => {
		await wait(1200);
		await p.locator('.svelte-flow__controls-fitview').first().click();
	}
});
await shot('integrations-sources', { who: 'admin', url: '/admin/integrations', clip: { x: 270, y: 70, width: 1140, height: 340 } });
await shot('security', {
	who: 'kam',
	url: '/profile',
	clip: { x: 270, y: 70, width: 830, height: 599 },
	before: (p) => p.getByText('Безопасность', { exact: true }).first().click()
});

await browser.close();
