// Сквозной сценарий сделки на живом бэкенде: создание → переход → комментарий → задача → файл.
import fs from 'node:fs';
import { BASE, choose, expect, field, newBrowser, newPage, step } from './a-lib.mjs';

const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
const title = `E2E сделка ${Date.now().toString().slice(-6)}`;
try {
	step('открыть форму создания');
	await page.goto(`${BASE}/deals?new=1`, { waitUntil: 'load' });
	await field(page, 'Название').fill(title);
	await choose(page, 'Организация', 'КГТУ', { type: 'КГТУ' });
	await field(page, 'Сумма, ₽').fill('777000');
	await page.getByTestId('deal-create-submit').click();
	await page.waitForURL(/\/deals\/[0-9a-f-]{36}$/, { timeout: 15000 });
	expect(await page.locator('h1').innerText() === title, 'карточка создана с нужным названием');

	step('главный переход');
	const primary = page.getByTestId('deal-primary-transition');
	await primary.waitFor();
	console.log('  кнопка:', (await primary.innerText()).trim());
	await primary.click();
	await page.locator('[data-testid=transition-submit]').waitFor();
	await page.getByTestId('transition-submit').click();
	await page.waitForTimeout(1200);
	const status = await page.locator('header .atmr-badge').first().innerText().catch(() => '');
	console.log('  статус после перехода:', status.trim());

	step('комментарий');
	await page.getByRole('tab', { name: /Обсуждение/ }).click();
	await field(page, '').count();
	const area = page.locator('textarea').first();
	await area.fill('Проверка **комментария** из сценария');
	await page.getByTestId('comment-send').click();
	await page.waitForSelector('[data-comment] .md strong', { timeout: 10000 });
	expect(true, 'комментарий добавлен, markdown отрисован');

	step('задача');
	await page.getByRole('tab', { name: /Задачи/ }).click();
	await page.getByTestId('task-new').click();
	await field(page, 'Название').fill('Позвонить заказчику');
	await page.getByTestId('task-submit').click();
	await page.getByText('Позвонить заказчику').first().waitFor({ timeout: 8000 });
	expect(true, 'задача создана');

	step('файл');
	await page.getByRole('tab', { name: 'Файлы' }).click();
	fs.writeFileSync('.shots/a/e2e-file.pdf', '%PDF-1.4\n%demo\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
	await page.setInputFiles('input[type=file]', '.shots/a/e2e-file.pdf');
	await page.getByTestId('attach-upload').click();
	await page.getByText('e2e-file.pdf').first().waitFor({ timeout: 15000 });
	expect(true, 'файл загружен и привязан');

	await page.screenshot({ path: '.shots/a/flow-final.png' });
	console.log('URL', page.url());
} catch (e) {
	await page.screenshot({ path: '.shots/a/flow-fail.png' });
	console.log('FAIL', e.message);
	process.exitCode = 1;
} finally {
	console.log('problems', JSON.stringify(page.__problems));
	await browser.close();
}
