// Удаление ПДн целиком: восстановить существующий запрос → новый запрос из списка (выбор субъекта) →
// «нужно второе подтверждение» → второй админ подтверждает → «Выполнить» открывает форму с заполненным субъектом → запрос создан.
//   node tools/scenarios/lead-erasure.mjs [--size 1440x900]
import { mkdirSync } from 'node:fs';
import { BASE, newBrowser, newPage } from '../lib.mjs';

const size = (process.argv.includes('--size') ? process.argv[process.argv.indexOf('--size') + 1] : '1440x900').split('x').map(Number);
mkdirSync('.shots/lead', { recursive: true });
const browser = await newBrowser();
const admin = await newPage(browser, { who: 'admin', width: size[0], height: size[1] });
const admin2 = await newPage(browser, { who: 'admin2', width: size[0], height: size[1] });
const shot = (page, name) => page.screenshot({ path: `.shots/lead/erasure-flow-${name}-${size.join('x')}.png` });
const step = (msg) => console.log('•', msg);
const fillReason = async (page) => {
	await page.locator('textarea').first().fill('Сотрудник просит удалить данные');
	await page.locator('.atmr-input__container', { hasText: 'Правовое основание' }).locator('input').fill('ст. 21 152-ФЗ — требование субъекта об уничтожении ПДн');
};

step('restore the pending request');
await admin.goto(`${BASE}/admin/erasure?status=grace`);
await admin.getByText('Удаляемов Пётр').first().click();
await admin.waitForSelector('[data-testid=erasure-restore]');
await shot(admin, 'detail');
await admin.click('[data-testid=erasure-restore]');
await admin.getByRole('button', { name: 'Восстановить', exact: true }).last().click();
await admin.waitForSelector('text=Удаление отменено');

step('new request: choose subject');
await admin.goto(`${BASE}/admin/erasure`);
await admin.click('[data-testid=erasure-new]');
await admin.waitForSelector('text=Чьи данные удалить');
await admin.getByPlaceholder('Фамилия или имя').click();
await admin.keyboard.type('Удаляем');
await admin.locator('[role=listbox] li', { hasText: 'Удаляемов' }).first().click();
await shot(admin, 'subject');
await admin.click('[data-testid=erasure-subject-next]');
await admin.waitForSelector('[data-testid=erasure-submit]');
await fillReason(admin);
await shot(admin, 'form');
await admin.click('[data-testid=erasure-submit]');
await admin.waitForSelector('text=Нужно второе подтверждение');
await shot(admin, 'pending');
await admin.click('[data-testid=to-approvals]');
await admin.waitForURL('**/admin/approvals');

step('second admin approves');
await admin2.goto(`${BASE}/admin/approvals`);
await admin2.getByRole('button', { name: 'Подтвердить' }).first().click();
await admin2.waitForSelector('text=Операция подтверждена');
await shot(admin2, 'approved');

step('execute from approvals');
await admin.goto(`${BASE}/admin/approvals?status=approved`);
await admin.getByRole('button', { name: 'Выполнить' }).first().click();
await admin.waitForSelector('[data-testid=erasure-submit]');
await admin.waitForURL((url) => !url.search.includes('approval_id'));
await shot(admin, 'prefilled');
await fillReason(admin);
await admin.click('[data-testid=erasure-submit]');
await admin.waitForURL('**/admin/erasure/*');
await admin.waitForSelector('[data-testid=erasure-reject]');
await shot(admin, 'created');

console.log('admin problems:', JSON.stringify(admin.__problems));
console.log('admin2 problems:', JSON.stringify(admin2.__problems));
await browser.close();
