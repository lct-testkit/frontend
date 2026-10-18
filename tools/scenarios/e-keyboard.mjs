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
  const confirm = page.locator('[role=dialog]').last();
  console.log('  (окно осталось: подтверждение закрытия)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
}
ok((await page.locator('[role=dialog]').count()) === 0, 'Esc закрыл окно');
ok(await opener.evaluate((el) => el === document.activeElement), 'фокус вернулся на кнопку «Новая сделка»');
await browser.close();
console.log('клавиатура: всё в порядке');
