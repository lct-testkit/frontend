// Opens every drawer, dialog and wizard of the app and takes a screenshot of each — the way to look at B9 (forms), B10 (messages), B13 (wizards).
//   node tools/forms-shots.mjs                                   (all, desktop, light)   → ../frontend-shots/forms/<name>-<size>-<theme>.png
//   node tools/forms-shots.mjs --sizes desktop,phone --theme rtk_default_dark --only deal,user
import { mkdir } from 'node:fs/promises';
import { BASE, SIZES, accessToken, newBrowser, newPage } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const sizeNames = opt('sizes', 'desktop').split(',');
const theme = opt('theme', 'rtk_default_light');
const only = opt('only', '')?.split(',').filter(Boolean);
const out = opt('out', '../frontend-shots/forms');
await mkdir(out, { recursive: true });

const token = await accessToken('admin');
const first = async (path) => {
	try {
		const j = await (await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } })).json();
		return (Array.isArray(j) ? j : j.items)?.[0]?.id ?? null;
	} catch {
		return null;
	}
};
const ids = {
	deal: await first('/api/deals?limit=1'),
	contact: await first('/api/contacts?limit=1'),
	org: await first('/api/organizations?limit=1'),
	user: (await (await fetch(`${BASE}/api/admin/users?limit=20`, { headers: { Authorization: `Bearer ${token}` } })).json()).items?.find((u) => u.status === 'invited')?.id ?? (await first('/api/admin/users?limit=1')),
	workflow: await first('/api/workflows?limit=1')
};

const byTestId = (id) => (page) => page.getByTestId(id).first().click();
const byName = (name) => (page) => page.getByRole('button', { name }).first().click();

// name · url · what opens it
const RECIPES = [
	['deal-new', '/deals?new=1', null],
	['deal-edit', `/deals/${ids.deal}`, byTestId('deal-edit')],
	['deal-reassign', `/deals/${ids.deal}`, byTestId('deal-reassign')],
	['deal-transition', `/deals/${ids.deal}`, byTestId('deal-primary-transition')],
	['contact-new', '/contacts', byTestId('new-contact')],
	['contact-edit', `/contacts/${ids.contact}`, byTestId('contact-edit')],
	['org-new', '/organizations', byTestId('new-org')],
	['task-new', '/tasks', byTestId('task-new')],
	['user-new', '/admin/users', byTestId('user-create')],
	['user-edit', `/admin/users/${ids.user}`, byTestId('user-edit')],
	['team-new', '/admin/teams', byTestId('team-create')],
	['product-new', '/catalog/products', byName(/Новый продукт/)],
	['direction-new', '/catalog/directions', byName(/Новое направление/)],
	['loss-reason-new', '/catalog/loss-reasons', byName(/Новая причина/)],
	['custom-field-new', '/catalog/custom-fields', byName(/Новое поле/)],
	['template-new', '/admin/notification-templates', byName(/Создать шаблон/)],
	['workflow-new', '/workflows', byName(/Создать воронку/)],
	['edm-new', '/admin/edm', byTestId('edm-create')],
	['registry-upload', '/admin/registry', byName(/Загрузить выгрузку/)],
	['report-run', '/reports', (page) => page.locator('main a, main button').filter({ hasText: 'Воронка по статусам' }).first().click()],
	['setting-edit', '/admin/settings?tab=system', (page) => page.locator('.atmr-tablegrid__row').nth(1).click()],
	['audit-confirm', '/admin/audit', byTestId('audit-export')],
	['audit-chain', '/admin/audit', byTestId('audit-chain')],
	['erasure-subject', '/admin/erasure', byTestId('erasure-new')],
	['filters-drawer', '/deals', byTestId('filters-more')],
	['global-search', '/deals', (page) => page.keyboard.press('Control+KeyK')],
	['import-wizard', '/imports/new', null],
	['offboard-wizard', `/admin/users/${ids.user}/offboard`, null],
	['send-wizard', `/deals/${ids.deal}?tab=signing`, byTestId('open-send-wizard')],
	['workflow-editor', `/workflows/${ids.workflow}`, null]
].filter(([name]) => !only.length || only.some((o) => name.includes(o)));

const browser = await newBrowser();
try {
	for (const sizeName of sizeNames) {
		const [w, h] = SIZES[sizeName] ?? sizeName.split('x').map(Number);
		const page = await newPage(browser, { who: 'admin', width: w, height: h, theme });
		for (const [name, url, open] of RECIPES) {
			try {
				await page.goto(BASE + url, { waitUntil: 'load' });
				await page.waitForLoadState('networkidle').catch(() => {});
				await page.waitForTimeout(500);
				if (open) await open(page);
				await page.waitForTimeout(900);
				const file = `${out}/${name}-${sizeName}-${theme.endsWith('dark') ? 'dark' : 'light'}.png`;
				await page.screenshot({ path: file });
				console.log(`✓ ${name} → ${file}`);
			} catch (e) {
				console.log(`✗ ${name}: ${String(e).split('\n')[0].slice(0, 120)}`);
			}
		}
		await page.context().close();
	}
} finally {
	await browser.close();
}
