// F3-14: незапечатанные события аудита на подменённых ответах (поля `delivery` и `pending` бэкенд ещё не отдаёт, нужны B8/B9).
//   sync: плашки нет, повторных запросов нет · queue: «Ожидают запечатывания», новая строка сверху после опроса, фильтр в адресе остался,
//   «Запечатывание задерживается» · окно проверки цепочки: «Не вошло в проверку» · выгрузка: число в тосте.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-audit-pending.mjs [--out .shots/f]
import { mkdir } from 'node:fs/promises';
import { BASE } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';

const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.shots/f';
await mkdir(out, { recursive: true });
const browser = await newBrowser();
const LIST = '**/api/admin/audit?*';
try {
	const theme = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : undefined;
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900, theme });
	const phone = await newPage(browser, { who: 'admin', width: 390, height: 844 });
	let listCalls = 0;
	let mode = 'sync'; // sync | sealing | sealed | delayed
	const NEW_ID = '00000000-0000-4000-8000-0000000f3140';
	await page.route(LIST, async (route) => {
		listCalls += 1;
		const res = await route.fetch();
		const body = await res.json();
		if (mode === 'sync') return route.fulfill({ response: res, json: body });
		body.delivery = 'queue';
		body.pending = mode === 'sealing' ? { count: 12, oldest_age_seconds: 4 } : mode === 'delayed' ? { count: 12, oldest_age_seconds: 130 } : { count: 0, oldest_age_seconds: 0 };
		if (mode === 'sealed' && body.items.length) {
			const first = body.items[0];
			body.items = [{ ...first, id: NEW_ID, created_at: new Date().toISOString(), occurred_at: new Date(Date.now() - 2000).toISOString() }, ...body.items.slice(0, 49)];
		}
		return route.fulfill({ response: res, json: body });
	});
	await page.route('**/api/admin/audit/verify-chain?*', async (route) => {
		const res = await route.fetch();
		const body = await res.json();
		return route.fulfill({ response: res, json: { ...body, delivery: 'queue', pending: { count: 12, oldest_age_seconds: 4 } } });
	});
	await page.route('**/api/admin/audit/export?*', async (route) => {
		const res = await route.fetch();
		return route.fulfill({ response: res, headers: { ...res.headers(), 'x-audit-pending': '12', 'access-control-expose-headers': 'X-Audit-Pending' } });
	});

	step('sync: плашки нет, повторных запросов нет');
	await page.goto(`${BASE}/admin/audit?result=success`, { waitUntil: 'load' });
	await page.waitForTimeout(2500);
	const calmBefore = listCalls;
	await page.waitForTimeout(16000);
	expect((await page.getByTestId('audit-pending').count()) === 0, 'плашки и подписи нет');
	expect(listCalls === calmBefore, `за 16 с повторных запросов списка нет (${listCalls - calmBefore})`);

	step('queue: ожидают запечатывания');
	mode = 'sealing';
	await page.reload({ waitUntil: 'load' });
	await page.getByTestId('audit-pending').waitFor({ timeout: 10000 });
	const text = await page.getByTestId('audit-pending').innerText();
	console.log('  плашка:', JSON.stringify(text));
	expect(/Ожидают запечатывания: 12/.test(text) && /4 с/.test(text), 'плашка «Ожидают запечатывания: 12», возраст 4 с');
	expect((await page.getByTestId('audit-pending').getAttribute('role')) === 'status', 'role=status');
	await page.screenshot({ path: `${out}/pending-sealing.png` });
	await phone.route(LIST, async (route) => {
		const res = await route.fetch();
		const body = await res.json();
		return route.fulfill({ response: res, json: { ...body, delivery: 'queue', pending: { count: 12, oldest_age_seconds: 4 } } });
	});
	await phone.goto(`${BASE}/admin/audit?result=success`, { waitUntil: 'load' });
	await phone.getByTestId('audit-pending').waitFor({ timeout: 10000 });
	await phone.screenshot({ path: `${out}/pending-sealing-phone.png` });

	step('queue: запечатались — новая строка сверху, фильтр в адресе остался');
	const firstRowBefore = await page.locator('[role=row], tr').nth(1).innerText();
	mode = 'sealed';
	await page.waitForFunction(() => document.querySelector('[data-testid=audit-pending]')?.getAttribute('data-state') === 'sealed', null, { timeout: 15000 });
	expect((await page.getByTestId('audit-pending').innerText()) === 'Все события запечатаны', 'подпись «Все события запечатаны»');
	expect(new URL(page.url()).searchParams.get('result') === 'success', 'фильтр result=success остался в адресе');
	const rows = await page.locator('[role=row], tr').allInnerTexts();
	console.log('  первая строка было/стало:', JSON.stringify(firstRowBefore.slice(0, 40)), '→', JSON.stringify(rows[1]?.slice(0, 40)));
	expect(rows[1] !== firstRowBefore, 'первая строка изменилась: новая запись сверху');
	await page.screenshot({ path: `${out}/pending-sealed.png` });

	step('queue: задерживается');
	mode = 'delayed';
	await page.reload({ waitUntil: 'load' });
	await page.getByTestId('audit-pending').waitFor({ timeout: 10000 });
	const delayed = await page.getByTestId('audit-pending').innerText();
	console.log('  плашка:', JSON.stringify(delayed));
	expect(/Запечатывание задерживается: 12 событий ждут 2 мин 10 с/.test(delayed) && delayed.includes('Обновить'), 'плашка-предупреждение с кнопкой «Обновить»');
	await page.screenshot({ path: `${out}/pending-delayed.png` });

	step('проверка цепочки');
	await page.getByTestId('audit-chain').click();
	await page.getByTestId('chain-pending').waitFor({ timeout: 10000 });
	const chain = await page.locator('body').innerText();
	expect(/Цепочка цела для запечатанных записей/.test(chain), 'заголовок «Цепочка цела для запечатанных записей»');
	expect(/Не вошло в проверку: 12 событий ждут запечатывания, самое старое — 4 с/.test(chain), 'строка «Не вошло в проверку»');
	await page.screenshot({ path: `${out}/pending-chain.png` });
	await page.keyboard.press('Escape');

	step('выгрузка');
	await page.getByTestId('audit-export').click();
	await page.waitForTimeout(500);
	const confirmText = await page.locator('body').innerText();
	expect(/не войдут события, ожидающие запечатывания/.test(confirmText), 'в подтверждении: «не войдут события, ожидающие запечатывания»');
	await page.getByRole('button', { name: 'Выгрузить', exact: true }).click();
	await page.waitForTimeout(1500);
	expect(/Не вошло ожидающих: 12/.test(await page.locator('body').innerText()), 'тост «Выгрузка готова. Не вошло ожидающих: 12»');
} finally {
	await browser.close();
}
