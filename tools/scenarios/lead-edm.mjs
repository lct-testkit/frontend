// Соглашения ЭДО: оформить (организация + скан) → появилось в списке → отозвать с причиной.
//   node tools/scenarios/lead-edm.mjs [--size 1440x900]
import { mkdirSync } from 'node:fs';
import { BASE, newBrowser, newPage } from '../lib.mjs';

const size = (process.argv.includes('--size') ? process.argv[process.argv.indexOf('--size') + 1] : '1440x900').split('x').map(Number);
mkdirSync('.shots/lead', { recursive: true });
const browser = await newBrowser();
const page = await newPage(browser, { who: 'admin', width: size[0], height: size[1] });
const shot = (name) => page.screenshot({ path: `.shots/lead/edm-${name}-${size.join('x')}.png` });
const step = (msg) => console.log('•', msg);

await page.goto(`${BASE}/admin/edm`);
await page.waitForSelector('[data-testid=edm-create]');
await shot('list-before');

step('open drawer');
await page.click('[data-testid=edm-create]');
await page.waitForSelector('text=Новое соглашение об ЭДО');

step('pick organization');
await page.getByPlaceholder('Название или ИНН').click();
await page.keyboard.type('КГТУ');
await page.waitForTimeout(600);
await shot('dropdown');
await page.locator('[role=listbox] li', { hasText: 'КГТУ' }).first().click();

step('fill number, dates, file');
await page.locator('.atmr-input__container', { hasText: 'Номер соглашения' }).locator('input').fill(`ЭДО-${Date.now().toString().slice(-6)}`);
await page.setInputFiles('[data-testid=dropzone-input]', { name: 'edo-agreement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') });
await page.waitForSelector('text=edo-agreement.pdf', { timeout: 20000 });
await shot('form');

step('save');
await page.click('[data-testid=edm-save]');
await page.waitForSelector('text=Соглашение оформлено');
await page.waitForSelector('[aria-label="Отозвать соглашение"]');
await shot('list-after');

step('revoke');
await page.click('[aria-label="Отозвать соглашение"] >> nth=0');
await page.waitForSelector('text=Отозвать соглашение >> nth=0');
await page.locator('textarea').last().fill('Тестовое соглашение, отзываем');
await shot('revoke');
await page.getByRole('button', { name: 'Отозвать', exact: true }).click();
await page.waitForSelector('text=Соглашение отозвано');
await shot('list-revoked');

console.log('problems:', JSON.stringify(page.__problems));
await browser.close();
