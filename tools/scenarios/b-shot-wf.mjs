// Скриншоты редактора воронки в разных состояниях (агент B): node tools/scenarios/b-shot-wf.mjs <code> <size> <name> [status-name | transition-label]
import { mkdir } from 'node:fs/promises';
import { BASE, SIZES, accessToken, newBrowser, newPage } from '../lib.mjs';

const [, , code = 'b2c_short_v1', size = 'desktop', name = 'wf', target] = process.argv;
const [w, h] = SIZES[size] ?? size.split('x').map(Number);
const token = await accessToken('admin');
await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
const list = await (await fetch(`${BASE}/api/workflows?limit=100`, { headers: { Authorization: `Bearer ${token}` } })).json();
const wf = list.items.find((x) => x.code === code);
await mkdir('.shots/b-wf', { recursive: true });
const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: w, height: h });
	await page.goto(`${BASE}/workflows/${wf.id}`);
	await page.waitForSelector('.svelte-flow__node', { timeout: 20000 });
	await page.waitForTimeout(1200);
	if (target) {
		const node = page.locator('.svelte-flow__node', { hasText: target }).first();
		if (await node.count()) await node.click();
		else {
			// на телефоне и планшете выбираем из списков
			const item = page.locator('button', { hasText: target }).first();
			if (await item.count()) await item.click();
			else await page.locator('.svelte-flow__edge-label', { hasText: target }).first().click();
		}
		await page.waitForTimeout(900);
	}
	const file = `.shots/b-wf/${name}-${size}.png`;
	await page.screenshot({ path: file, fullPage: false });
	console.log(file, JSON.stringify(page.__problems));
} finally {
	await browser.close();
}
