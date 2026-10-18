// Доска сделок: смена статуса без перетаскивания (F7-15). Кнопка на карточке → меню «В статус …» → диалог перехода (не отправляется).
//   APP_URL=http://localhost:5275 node tools/scenarios/e-board-move.mjs [--shots dir]
import { mkdirSync } from 'node:fs';
import { BASE, SIZES, newBrowser, newPage } from '../lib.mjs';
const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const shots = arg('--shots');
if (shots) mkdirSync(shots, { recursive: true });
let bad = 0;
const check = (c, m) => {
	console.log(`  ${c ? '✓' : '✗'} ${m}`);
	if (!c) bad = 1;
};
const browser = await newBrowser();
try {
	for (const size of ['desktop', 'phone']) {
		console.log(size);
		const [width, height] = SIZES[size];
		const page = await newPage(browser, { who: 'head', width, height });
		await page.goto(`${BASE}/deals?view=board`, { waitUntil: 'load' });
		const btn = page.getByTestId('board-move').first();
		await btn.waitFor({ timeout: 20000 });
		const box = await btn.boundingBox();
		check(box.width >= 24 && box.height >= 24, `кнопка на карточке есть (${Math.round(box.width)}×${Math.round(box.height)}; зона касания 44 px — невидимая)`);
		await btn.focus();
		await page.keyboard.press('Enter');
		const item = page.getByText(/^В статус «/).first();
		await item.waitFor({ timeout: 8000 });
		check(true, 'Enter открывает меню «В статус …»');
		if (shots) await page.screenshot({ path: `${shots}/menu-${size}.png` });
		await item.click();
		await page.locator('[role=dialog]').first().waitFor({ timeout: 8000 });
		check((await page.locator('[role=dialog]').count()) > 0, 'выбор пункта открывает диалог перехода');
		if (shots) await page.screenshot({ path: `${shots}/dialog-${size}.png` });
		await page.keyboard.press('Escape');
		await page.context().close();
	}
	const aud = await newPage(browser, { who: 'auditor' });
	await aud.goto(`${BASE}/deals?view=board`, { waitUntil: 'load' });
	await aud.waitForTimeout(2500);
	check((await aud.getByTestId('board-move').count()) === 0, 'у аудитора кнопок нет');
} finally {
	await browser.close();
}
process.exitCode = bad;
