// F3-12: колонка «Сущность» журнала аудита — названия вместо коротких id, число запросов на страницу, 403 у Аудитора.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-audit-entities.mjs [--out .shots/f]
import { mkdir } from 'node:fs/promises';
import { BASE } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';

const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.shots/f';
await mkdir(out, { recursive: true });
const browser = await newBrowser();
try {
	for (const who of ['admin', 'auditor', 'head']) {
		step(`журнал под ${who}`);
		const page = await newPage(browser, { who, width: 1440, height: 900 });
		const calls = [];
		page.on('response', (r) => {
			const u = new URL(r.url());
			if (u.pathname.startsWith('/api/') && !u.pathname.startsWith('/api/admin/audit')) calls.push(`${r.status()} ${u.pathname}`);
		});
		await page.goto(`${BASE}/admin/audit`, { waitUntil: 'load' });
		await page.waitForTimeout(4000);
		const rows = await page.locator('[role=row], tr').allInnerTexts();
		const entity = rows.map((r) => r.split('\n').join(' | ')).filter((r) => r.length > 10).slice(0, 60);
		const short = entity.filter((r) => /\b[0-9a-f]{8}\b/.test(r));
		console.log(`  строк: ${entity.length}, с коротким id: ${short.length}`);
		for (const r of short.slice(0, 8)) console.log('   · ' + r.slice(0, 160));
		const bad = calls.filter((c) => !c.startsWith('200') && !c.startsWith('304'));
		console.log(`  запросов (кроме аудита): ${calls.length}, не 200: ${JSON.stringify(bad.slice(0, 6))}`);
		expect(calls.length <= 20, `запросов на страницу ${calls.length} <= 20`);
		await page.screenshot({ path: `${out}/audit-${who}.png` });
		if (who === 'auditor') expect(bad.length === 0, 'у Аудитора нет ответов 403/404');
		await page.context().close();
	}
} finally {
	await browser.close();
}
