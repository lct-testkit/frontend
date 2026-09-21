// Диалог перехода на живом бэкенде: заблокированный переход, отказ с причиной и комментарием, конфликт версий (CRM-1002).
import { BASE, accessToken } from '../lib.mjs';
import { choose, expect, field, newBrowser, newPage, step } from './a-lib.mjs';

const tok = await accessToken('kam');
const api = async (method, path, body, headers = {}) => {
	const r = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
	return { status: r.status, json: await r.json().catch(() => null) };
};
const find = async (q) => (await api('GET', `/api/deals?q=${encodeURIComponent(q)}&limit=1`)).json.items[0];
const created = async () => {
	const orgs = (await api('GET', '/api/organizations?q=КГТУ&limit=1')).json.items[0];
	return (await api('POST', '/api/deals', { title: `Сценарий переходов ${Date.now().toString().slice(-5)}`, deal_type: 'b2b', organization_id: orgs.id, amount: '100000', currency: 'RUB', priority: 'normal' }, { 'Idempotency-Key': crypto.randomUUID() })).json;
};

const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
try {
	step('заблокированный переход (нужна подпись)');
	const blocked = await find('D-2026-000006');
	await page.goto(`${BASE}/deals/${blocked.id}`, { waitUntil: 'load' });
	await page.getByTestId('deal-primary-transition').click();
	await page.getByTestId('conditions').waitFor();
	console.log('  условия:', (await page.getByTestId('conditions').innerText()).replace(/\n+/g, ' | '));
	expect(await page.getByTestId('transition-submit').isDisabled(), 'кнопка «Перейти» заблокирована, пока нет подписи');
	await page.screenshot({ path: '.shots/a/transition-blocked.png' });
	await page.keyboard.press('Escape');

	step('отказ: причина + комментарий');
	const d1 = await created();
	await page.goto(`${BASE}/deals/${d1.id}`, { waitUntil: 'load' });
	await page.getByRole('button', { name: 'Отказ', exact: true }).click();
	await page.getByTestId('transition-submit').waitFor();
	await page.screenshot({ path: '.shots/a/transition-lost.png' });
	await page.getByTestId('transition-submit').click();
	await page.waitForTimeout(600);
	console.log('  без данных →', (await page.locator('[role=dialog], .atmr-modal').first().innerText()).replace(/\n+/g, ' | ').slice(0, 220));
	await choose(page, 'Причина отказа', 'Не устроила цена');
	await field(page, 'Комментарий (обязательно)').fill('Клиент выбрал другого поставщика');
	await page.getByTestId('transition-submit').click();
	await page.waitForTimeout(1500);
	const chip = await page.locator('main header').first().innerText();
	expect(chip.includes('Отказ'), 'сделка в статусе «Отказ»');

	step('конфликт версий');
	const d2 = await created();
	await page.goto(`${BASE}/deals/${d2.id}`, { waitUntil: 'load' });
	await page.getByTestId('deal-primary-transition').waitFor();
	const patched = await api('PATCH', `/api/deals/${d2.id}`, { title: 'Изменено в другой вкладке' }, { 'If-Match': `"${d2.version}"` });
	console.log('  PATCH из «другой вкладки»:', patched.status);
	await page.getByTestId('deal-primary-transition').click();
	await page.getByTestId('transition-submit').click();
	await page.getByText('изменена другим пользователем').first().waitFor({ timeout: 8000 });
	expect(true, 'баннер конфликта в диалоге');
	await page.locator('.atmr-modal-wrapper').getByRole('button', { name: 'Обновить', exact: true }).click();
	await page.waitForTimeout(1200);
	await page.getByTestId('transition-submit').click();
	await page.waitForTimeout(1500);
	expect((await page.locator('main header').first().innerText()).includes('Первичный контакт'), 'после «Обновить» переход прошёл');
} catch (e) {
	await page.screenshot({ path: '.shots/a/transition-fail.png' });
	console.log('FAIL', e.message);
	process.exitCode = 1;
} finally {
	console.log('problems', JSON.stringify(page.__problems));
	await browser.close();
}
