// Защита от потери правок в редакторе воронки (агент B): несохранённые правки → «Выйти без сохранения?» при уходе со страницы.
//   node tools/scenarios/b-workflow-guard.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const token = await accessToken('admin');
const list = await (await fetch(`${BASE}/api/workflows?limit=50`, { headers: { Authorization: `Bearer ${token}` } })).json();
const wf = list.items.find((w) => w.code === 'b2c_short_v1');
const browser = await newBrowser();
let bad = 0;
const check = (c, m) => (console.log(`  ${c ? '✓' : '✗'} ${m}`), c || (bad = 1));
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await page.goto(`${BASE}/workflows/${wf.id}`);
	await page.waitForSelector('.svelte-flow__node');
	await page.getByLabel('Добавить статус').click();
	await page.waitForTimeout(400);
	check((await page.getByText('Не сохранено').count()) > 0, 'после правки в шапке метка «Не сохранено»');
	await page.getByLabel('Назад', { exact: true }).click();
	await page.waitForTimeout(500);
	check((await page.getByText('Выйти без сохранения?').count()) > 0, 'уход со страницы спрашивает подтверждение');
	await page.getByRole('button', { name: 'Отмена' }).click();
	await page.waitForTimeout(300);
	check(page.url().includes('/workflows/') && !page.url().endsWith('/workflows'), 'после «Отмена» остаёмся в редакторе');
	await page.getByLabel('Назад', { exact: true }).click();
	await page.getByRole('button', { name: 'Выйти', exact: true }).click();
	await page.waitForURL(/\/workflows$/, { timeout: 8000 }).catch(() => {});
	check(page.url().endsWith('/workflows'), 'после «Выйти» открыт список воронок');
} finally {
	await browser.close();
}
process.exitCode = bad;
