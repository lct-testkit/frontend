// Скриншоты экранов после перевода на rt-ui (агент D): диалог перехода, баннеры конфликта, черновик организации.
// node tools/scenarios/d-shots.mjs [light|dark]
import { BASE, accessToken } from '../lib.mjs';
import { newBrowser, newPage, step } from './a-lib.mjs';

const theme = process.argv[2] === 'dark' ? 'rtk_default_dark' : 'rtk_default_light';
const sfx = theme.endsWith('dark') ? '-dark' : '';
const tok = await accessToken('kam');
const api = async (method, path, body, headers = {}) => {
	const r = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
	return { status: r.status, json: await r.json().catch(() => null) };
};
const find = async (q) => (await api('GET', `/api/deals?q=${encodeURIComponent(q)}&limit=1`)).json.items[0];
const created = async () => {
	const org = (await api('GET', '/api/organizations?q=КГТУ&limit=1')).json.items[0];
	return (await api('POST', '/api/deals', { title: `Снимки D ${Date.now().toString().slice(-5)}`, deal_type: 'b2b', organization_id: org.id, amount: '100000', currency: 'RUB', priority: 'normal' }, { 'Idempotency-Key': crypto.randomUUID() })).json;
};

const browser = await newBrowser();
try {
	for (const [w, h, label] of [[1440, 900, 'desktop'], [390, 844, 'phone'], [360, 640, 'phone-s']]) {
		const page = await newPage(browser, { who: 'kam', width: w, height: h, theme });
		step(`${label}: заблокированный переход`);
		const blocked = await find('D-2026-000006');
		await page.goto(`${BASE}/deals/${blocked.id}`, { waitUntil: 'load' });
		await page.getByTestId('deal-primary-transition').click();
		await page.getByTestId('conditions').waitFor();
		await page.waitForTimeout(500);
		await page.screenshot({ path: `.shots/d/dlg-blocked-${label}${sfx}.png` });

		step(`${label}: конфликт версий в диалоге`);
		const d = await created();
		await page.goto(`${BASE}/deals/${d.id}`, { waitUntil: 'load' });
		await page.getByTestId('deal-primary-transition').waitFor();
		await api('PATCH', `/api/deals/${d.id}`, { title: 'Изменено в другой вкладке' }, { 'If-Match': `"${d.version}"` });
		await page.getByTestId('deal-primary-transition').click();
		await page.getByTestId('transition-submit').click();
		await page.getByText('изменена другим пользователем').first().waitFor({ timeout: 8000 });
		await page.waitForTimeout(400);
		await page.screenshot({ path: `.shots/d/dlg-conflict-${label}${sfx}.png` });
		await page.keyboard.press('Escape');

		console.log('   problems', JSON.stringify(page.__problems?.failed));
		await page.close();
	}
} catch (e) {
	console.log('FAIL', e.message);
	process.exitCode = 1;
} finally {
	await browser.close();
}
