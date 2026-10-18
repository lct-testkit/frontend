// F3-11: «Недоступно вашей роли» с перечнем ролей — на доске (перетаскивание), в меню «Ещё», на ленте шагов и в диалоге (прямой запрос).
//   APP_URL=http://localhost:5275 node tools/scenarios/f-role-hint.mjs [--out .shots/f]
import { mkdir } from 'node:fs/promises';
import { BASE } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';
import { apiAs, deleteDealsByTitle, walkDeal } from './f-lib.mjs';

const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.shots/f';
await mkdir(out, { recursive: true });
const TITLE = 'F3-11 проверка роли';
const kam = await apiAs('kam');
const wf = (await kam('/api/workflows?state=published&limit=20')).body.items.find((w) => w.deal_type === 'b2b' && w.is_default);
const g = (await kam(`/api/workflows/${wf.id}`)).body;
const graph = g.graph ?? g;
const won = graph.statuses.find((s) => s.type === 'won');
const toWon = graph.transitions.find((t) => t.to_status_id === won.id);
const from = graph.statuses.find((s) => s.id === toWon.from_status_id);
console.log(`переход в «${won.name}» из «${from.name}», роли: ${JSON.stringify(toWon.allowed_roles)}`);
expect(toWon.allowed_roles.length > 0, 'у закрытия сделки заданы allowed_roles');

const { deal } = await walkDeal('kam', from.name, TITLE);
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
const second = await newPage(browser, { who: 'kam', width: 390, height: 844 });
try {
	step('доска: перетаскивание в закрытую сделку');
	await page.goto(`${BASE}/deals?view=board&workflow=${wf.id}&q=${encodeURIComponent(TITLE)}`, { waitUntil: 'load' });
	const card = page.locator(`a[draggable=true][href="/deals/${deal.id}"]`);
	await card.waitFor({ timeout: 15000 });
	const target = page.locator(`section[aria-label="${won.name[0].toUpperCase() + won.name.slice(1)}"]`);
	await target.waitFor();
	const requests = [];
	page.on('request', (r) => r.url().includes('available-transitions') && requests.push(r.url()));
	await card.dragTo(target, { targetPosition: { x: 100, y: 60 } });
	await page.waitForTimeout(800);
	const toast = await page.locator('.atmr-notification, [class*=notification]').allInnerTexts();
	console.log('  тосты:', JSON.stringify(toast));
	expect(toast.some((t) => t.includes('Недоступно вашей роли') && t.includes('Руководитель')), 'toast «Недоступно вашей роли» с перечнем ролей');
	expect((await page.locator('[role=dialog], .atmr-modal').count()) === 0, 'диалог перехода не открылся');
	expect(requests.length === 1, `запросов available-transitions: ${requests.length} (кэш на 30 с)`);
	await page.screenshot({ path: `${out}/board-denied.png` });

	step('карточка: меню «Ещё» и лента шагов');
	await page.goto(`${BASE}/deals/${deal.id}`, { waitUntil: 'load' });
	await page.waitForTimeout(1500);
	await page.getByRole('button', { name: 'Ещё' }).click();
	await page.waitForTimeout(600);
	await page.screenshot({ path: `${out}/header-menu.png` });
	const menu = await page.locator('body').innerText();
		expect(/Только: Руководитель, Администратор/.test(menu), 'пункт меню подписан «Только: Руководитель, Администратор»');
	await page.keyboard.press('Escape');
	const stepTitle = await page.locator('ol li div[title*="Недоступно"]').first().getAttribute('title').catch(() => null);
	console.log('  шаг ленты:', stepTitle);

	step('прямой запрос запрещённого перехода');
	const res = await kam(`/api/deals/${deal.id}/transition`, { method: 'POST', headers: { 'If-Match': `"${deal.version}"` }, body: JSON.stringify({ to_status_id: won.id, comment: 'проверка', fields: {}, attachments: [] }) });
	console.log('  ответ:', res.status, JSON.stringify(res.body).slice(0, 220));
	expect(res.status === 403 && res.body.code === 'CRM-1202', '403 CRM-1202');

	step('телефон: меню «Ещё»');
	await second.goto(`${BASE}/deals/${deal.id}`, { waitUntil: 'load' });
	await second.waitForTimeout(1500);
	await second.screenshot({ path: `${out}/card-phone.png` });
} finally {
	await browser.close();
	console.log('удалено тестовых сделок:', await deleteDealsByTitle(TITLE));
}
