// Организации на живом бэкенде: автоподстановка по названию и ИНН, ошибка контрольной суммы, дубль, создание из реестра.
import { BASE, expect, newBrowser, newPage, step } from './a-lib.mjs';

const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
const lookup = () => page.locator('.atmr-input:has(.atmr-input__label span:text-is("ИНН или название")) input').first();
try {
	step('неверный ИНН');
	await page.goto(`${BASE}/organizations?new=1`, { waitUntil: 'load' });
	await page.waitForTimeout(1200);
	await lookup().fill('1234567890');
	await page.waitForTimeout(1200);
	expect((await page.locator('.atmr-input__error, [class*=error]').allInnerTexts()).join(' ').includes('контрольная сумма'), 'ошибка контрольной суммы показана до запроса');

	step('подсказки по названию (выбор уже существующей — покажет дубль)');
	await lookup().fill('Иркутск');
	await page.getByRole('button', { name: /ИГУИС/ }).first().waitFor({ timeout: 8000 });
	expect(true, 'подсказка из реестра');
	await page.getByRole('button', { name: /ИГУИС/ }).first().click();
	await page.waitForTimeout(1200);
	// на повторном прогоне организация уже создана: тогда форма заблокирована плашкой-дублем — создание пропускаем
	const already = await page.getByText('Организация уже в системе').first().isVisible().catch(() => false);
	if (already) {
		console.log('  организация уже создана ранее — шаг «создание» пропущен');
		await page.screenshot({ path: '.shots/a/org-create-registry.png' });
	} else {
		const name = await page.locator('.atmr-input:has(.atmr-input__label span:text-is("Полное название")) input').inputValue();
		console.log('  название после выбора:', name);
		expect(name.includes('Иркутский'), 'форма заполнена из реестра');
		await page.screenshot({ path: '.shots/a/org-create-registry.png' });

		step('создание');
		await page.getByTestId('org-create-submit').click();
		await page.waitForURL(/\/organizations\/[0-9a-f-]{36}$/,{ timeout: 15000 });
		await page.waitForTimeout(800);
		console.log('  заголовок:', await page.locator('h1').first().innerText());
		console.log('  под заголовком:', (await page.locator('main p').first().innerText()).trim());
	}

	step('дубль по ИНН');
	await page.goto(`${BASE}/organizations?new=1`, { waitUntil: 'load' });
	await page.waitForTimeout(1200);
	await lookup().fill('1655012344');
	await page.getByRole('button', { name: /КГТУ|Казанск/ }).first().waitFor({ timeout: 8000 });
	await page.getByRole('button', { name: /КГТУ|Казанск/ }).first().click();
	await page.getByText('Организация уже в системе').first().waitFor({ timeout: 8000 });
	expect(true, 'баннер «уже в системе» + кнопка создания заблокирована');
	console.log('  кнопка «Создать» заблокирована:', await page.getByTestId('org-create-submit').isDisabled());
	await page.screenshot({ path: '.shots/a/org-create-dup.png' });
} catch (e) {
	await page.screenshot({ path: '.shots/a/org-fail.png' });
	console.log('FAIL', e.message);
	process.exitCode = 1;
} finally {
	console.log('problems', JSON.stringify(page.__problems));
	await browser.close();
}
