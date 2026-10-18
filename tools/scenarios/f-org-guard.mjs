// Защита от потери правок карточки организации (F7-14): правка реквизитов → уход на другую страницу спрашивает, смена вкладки — нет.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-org-guard.mjs   (ничего не сохраняет)
import { BASE, newBrowser, newPage } from '../lib.mjs';
import { routesFor } from '../routes.mjs';

const { routes } = await routesFor('admin');
const org = routes.find((r) => /^\/organizations\/[0-9a-f-]{20,}/.test(r));
const browser = await newBrowser();
let bad = 0;
const check = (c, m) => {
	console.log(`  ${c ? '✓' : '✗'} ${m}`);
	if (!c) bad = 1;
};
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await page.goto(BASE + org, { waitUntil: 'load' });
	const field = page.locator('.atmr-input:has(.atmr-input__label span:text-is("Краткое название")) input').first();
	await field.waitFor({ timeout: 15000 });
	const before = await field.inputValue();
	await field.fill(before + ' (правка)');
	await page.getByRole('tab', { name: /Контакты/ }).first().click();
	await page.waitForTimeout(500);
	check((await page.getByText('Выйти без сохранения?').count()) === 0, 'смена вкладки карточки вопроса не вызывает');
	await page.getByRole('tab', { name: /Реквизиты/ }).first().click();
	check((await field.inputValue()) === before + ' (правка)', 'правка на месте после возврата на вкладку');
	await page.locator('.atmr-side-menu').getByText('Задачи', { exact: true }).first().click();
	await page.waitForTimeout(500);
	check((await page.getByText('Выйти без сохранения?').count()) > 0, 'уход на другую страницу спрашивает подтверждение');
	await page.getByRole('button', { name: 'Отмена' }).last().click();
	await page.waitForTimeout(400);
	check(new URL(page.url()).pathname.startsWith('/organizations/'), 'после «Отмена» остаёмся в карточке');
	await page.locator('.atmr-side-menu').getByText('Задачи', { exact: true }).first().click();
	await page.getByRole('button', { name: 'Выйти', exact: true }).click();
	await page.waitForURL(/\/tasks/, { timeout: 8000 }).catch(() => {});
	check(new URL(page.url()).pathname === '/tasks', 'после «Выйти» открыты задачи');
} finally {
	await browser.close();
}
process.exitCode = bad;
