// Скриншоты шагов мастера импорта на нужном размере (агент B): node tools/scenarios/b-shot-imports.mjs <size> — шаги 1, 2 и 3 (задание остаётся черновиком).
import { resolve } from 'node:path';
import { BASE, SIZES, newBrowser, newPage } from '../lib.mjs';

const size = process.argv[2] ?? 'phone';
const [w, h] = SIZES[size] ?? size.split('x').map(Number);
const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: w, height: h });
	await page.goto(`${BASE}/imports/new`);
	await page.waitForSelector('text=Что загружаем');
	await page.screenshot({ path: `.shots/b-data/imp1-${size}.png` });
	await page.locator('input[type=file]').setInputFiles(resolve('.shots/b-data/orgs.xlsx'));
	await page.waitForTimeout(500);
	await page.getByRole('button', { name: 'Загрузить и продолжить' }).click();
	await page.waitForSelector('text=Колонка файла, text=Примеры', { timeout: 30000 }).catch(() => {});
	await page.waitForTimeout(1500);
	await page.screenshot({ path: `.shots/b-data/imp2-${size}.png` });
	await page.getByRole('button', { name: 'Далее', exact: true }).click();
	await page.waitForSelector('text=Всего строк в файле', { timeout: 60000 });
	await page.screenshot({ path: `.shots/b-data/imp3-${size}.png` });
	console.log('ok', JSON.stringify(page.__problems));
} finally {
	await browser.close();
}
