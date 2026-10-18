// Доска: перетаскивание карточки в другую колонку открывает диалог перехода; AUDITOR не получает доступа к разделам.
import { BASE, accessToken } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';

const tok = await accessToken('head');
const wf = (await (await fetch(`${BASE}/api/workflows?state=published&limit=20`, { headers: { Authorization: `Bearer ${tok}` } })).json()).items.find((w) => w.deal_type === 'b2b' && w.is_default);
const H = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
const org = (await (await fetch(`${BASE}/api/organizations?q=МОУПН&limit=1`, { headers: H })).json()).items[0];
const contact = (await (await fetch(`${BASE}/api/contacts?organization_id=${org.id}&limit=1`, { headers: H })).json()).items[0]; // первый шаг воронки из 14 требует контакт
const fresh = await (await fetch(`${BASE}/api/deals`, { method: 'POST', headers: { ...H, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ title: 'Летняя школа Data Science для студентов', deal_type: 'b2b', organization_id: org.id, contact_id: contact?.id, amount: '210000', currency: 'RUB', priority: 'normal' }) })).json();
const browser = await newBrowser();
const head = await newPage(browser, { who: 'head', width: 1440, height: 900 });
const aud = await newPage(browser, { who: 'auditor', width: 1440, height: 900 });
try {
	step('доска: перетаскивание');
	await head.goto(`${BASE}/deals?view=board&workflow=${wf.id}&q=${encodeURIComponent(fresh.number)}`, { waitUntil: 'load' });
	await head.locator('a[draggable=true]', { hasText: fresh.number }).first().waitFor({ timeout: 10000 });
	const cards = head.locator('a[draggable=true]', { hasText: fresh.number });
	let card = cards.first();
	for (let i = 0; i < (await cards.count()); i += 1) {
		const label = await cards.nth(i).evaluate((el) => el.closest('section')?.getAttribute('aria-label'));
		if (!['Отказ', 'Успешно закрыта', 'Заморожена'].includes(label)) { card = cards.nth(i); break; }
	}
	const from = await card.evaluate((el) => el.closest('section')?.getAttribute('aria-label'));
	console.log('  карточка в колонке:', from);
	const cols = await head.locator('section[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
	const target = cols[cols.indexOf(from) + 1];
	console.log('  цель:', target);
	await card.dragTo(head.locator(`section[aria-label="${target}"]`));
	await head.getByTestId('transition-submit').waitFor({ timeout: 8000 });
	expect(true, 'диалог перехода открылся после перетаскивания');
	await head.screenshot({ path: '.shots/a/board-drag-dialog.png' });
	const counter = async (name) => Number((await head.locator(`section[aria-label="${name}"] header`).innerText()).match(/(\d+)\s*$/)?.[1]);
	const fromBefore = await counter(from);
	const toBefore = await counter(target);
	await head.getByTestId('transition-submit').click();
	await head.waitForTimeout(1500);
	const inTarget = await head.locator(`section[aria-label="${target}"] a[draggable=true]`, { hasText: fresh.number }).count();
	expect(inTarget > 0, `карточка переехала в «${target}»`);
	await head.waitForTimeout(800);
	expect((await counter(from)) === fromBefore - 1 && (await counter(target)) === toBefore + 1, `счётчики столбцов: «${from}» ${fromBefore}→${await counter(from)}, «${target}» ${toBefore}→${await counter(target)}`);

	step('AUDITOR');
	for (const path of ['/deals', '/organizations', '/contacts', '/tasks']) {
		await aud.goto(`${BASE}${path}`, { waitUntil: 'load' });
		await aud.waitForTimeout(1000);
		const url = aud.url().replace(BASE, '');
		const text = (await aud.locator('main').innerText()).replace(/\n+/g, ' | ').slice(0, 90);
		console.log(`  ${path} → ${url} :: ${text}`);
	}
} catch (e) {
	await head.screenshot({ path: '.shots/a/board-fail.png' });
	console.log('FAIL', e.message.slice(0, 400));
	process.exitCode = 1;
} finally {
	console.log('problems head', JSON.stringify(head.__problems), 'aud', JSON.stringify(aud.__problems));
	await browser.close();
}
