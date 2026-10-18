// Клавиатура и фокус (F7-4) против живого стенда: ссылка пропуска, ловушка Tab в панели, возврат фокуса на кнопку-открывашку.
//   APP_URL=http://localhost:5275 node tools/scenarios/e-keyboard.mjs
import { BASE, newBrowser, newPage } from '../lib.mjs';
const ok = (c, m) => { if (!c) throw new Error(`ASSERT: ${m}`); console.log(`  ✓ ${m}`); };
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam' });
await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
await page.waitForSelector('main', { timeout: 15000 });
await page.waitForTimeout(1500);

// 1. первый Tab — ссылка пропуска, Enter — фокус на main#content
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('Tab');
const first = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), visible: document.activeElement?.getBoundingClientRect().width > 0 && getComputedStyle(document.activeElement).position === 'fixed' }));
ok(first.text === 'Перейти к содержимому' && first.visible, 'первый Tab — видимая ссылка «Перейти к содержимому»');
await page.keyboard.press('Enter');
ok(await page.evaluate(() => document.activeElement?.id === 'content'), 'Enter переводит фокус на main#content');

// 2. панель «Новая сделка»: роль, фокус внутри, 12 Tab и Shift+Tab не выводят наружу
const opener = page.getByRole('button', { name: 'Новая сделка' }).first();
await opener.focus();
await page.keyboard.press('Enter');
const dialog = page.locator('[role=dialog][aria-modal=true]').first();
await dialog.waitFor({ timeout: 5000 });
ok((await dialog.getAttribute('aria-label')) === 'Новая сделка', 'окно: role=dialog, aria-modal, aria-label «Новая сделка»');
await page.waitForTimeout(500);
ok(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'фокус при открытии внутри окна');
let outside = 0;
for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog], .atmr-dropdown-menu, .atmr-popover')))) outside++; }
for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); if (!(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog], .atmr-dropdown-menu, .atmr-popover')))) outside++; }
ok(outside === 0, '18 нажатий Tab/Shift+Tab: фокус ни разу не вне окна');

// 3. Esc закрывает, фокус возвращается на «Новая сделка»
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
if (await dialog.count()) { // форма с вводом спрашивает подтверждение
  console.log('  (окно осталось: подтверждение закрытия)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
}
ok((await page.locator('[role=dialog]').count()) === 0, 'Esc закрыл окно');
ok(await opener.evaluate((el) => el === document.activeElement), 'фокус вернулся на кнопку «Новая сделка»');

// 4. таблица сделок: role=table с именем, одна остановка Tab, стрелки по строкам, Enter открывает карточку
await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
await page.waitForSelector('[role=table]', { timeout: 15000 });
await page.waitForTimeout(1000);
ok((await page.locator('[role=table]').first().getAttribute('aria-label')) === 'Сделки', 'таблица: role=table, имя «Сделки»');
ok((await page.locator('[role=table] [role=columnheader]').count()) >= 5, 'заголовки колонок: role=columnheader');
ok((await page.locator('[role=table] [data-table-row="true"][tabindex="0"]').count()) === 0, 'строки DS без мёртвого tabindex=0');
// строки со ссылкой (сделки): ссылка в первой ячейке — вход с клавиатуры; тут же проверяем остановки Tab у строк без ссылки (пользователи)
const admin = await newPage(browser, { who: 'admin' });
await admin.goto(`${BASE}/admin/users`, { waitUntil: 'load' });
await admin.waitForSelector('[role=table]', { timeout: 15000 });
await admin.waitForTimeout(1500);
ok((await admin.locator('[role=table]').first().getAttribute('aria-label')) === 'Пользователи', 'пользователи: role=table, имя «Пользователи»');
await admin.getByPlaceholder('Имя или email').first().focus();
let stops = 0;
for (let i = 0; i < 30; i++) {
	await admin.keyboard.press('Tab');
	const where = await admin.evaluate(() => (document.activeElement?.closest('[role=table]') ? (document.activeElement.closest('[data-table-row]') ? 'row' : 'head') : 'out'));
	if (where === 'row') stops++;
	if (where === 'out' && i > 3) break;
}
ok(stops === 1, `Tab: в строках таблицы пользователей ровно одна остановка (${stops})`);
await admin.locator('[role=table] [tabindex="0"]').first().focus();
await admin.keyboard.press('ArrowDown');
ok(await admin.evaluate(() => document.activeElement?.closest('[data-table-row]')?.getAttribute('aria-rowindex') === '3'), 'ArrowDown: вторая строка (aria-rowindex 3)');
await admin.keyboard.press('Enter');
await admin.waitForURL(/\/admin\/users\/[0-9a-f-]+/, { timeout: 8000 });
ok(true, 'Enter открывает карточку пользователя');
await browser.close();
console.log('клавиатура: всё в порядке');
