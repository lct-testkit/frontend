// Живые области и поля (F7-6) против живого стенда: ошибка поля связана с полем, тосты озвучиваются, «Загрузка» / «Готово».
//   APP_URL=http://localhost:5275 node tools/scenarios/e-live.mjs
import { BASE, newBrowser, newPage } from '../lib.mjs';
const ok = (c, m) => { if (!c) throw new Error(`ASSERT: ${m}`); console.log(`  ✓ ${m}`); };
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam' });
await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
await page.waitForSelector('[role=table]', { timeout: 15000 });
ok((await page.locator('[role=status][aria-live=polite], [role=alert][aria-live=assertive]').count()) >= 3, 'живые области AnnouncerHost на странице');

// 1. форма «Новая сделка»: пустое обязательное поле → aria-invalid и описание = текст ошибки
await page.getByRole('button', { name: 'Новая сделка' }).first().click();
const dialog = page.locator('[role=dialog]').first();
await dialog.waitFor();
await page.waitForTimeout(500);
await dialog.getByRole('button', { name: /^Создать/ }).first().click();
await page.waitForTimeout(600);
const linked = await dialog.evaluate((d) => {
	const bad = [...d.querySelectorAll('input[aria-invalid="true"], textarea[aria-invalid="true"]')];
	return bad.map((i) => ({ name: i.getAttribute('aria-describedby') && document.getElementById(i.getAttribute('aria-describedby'))?.textContent?.trim(), live: document.getElementById(i.getAttribute('aria-describedby') ?? '')?.getAttribute('aria-live') }));
});
ok(linked.length > 0 && linked.every((l) => l.name && l.live === 'polite'), `ошибка поля связана: aria-invalid + describedby (${linked.length} полей: «${linked[0]?.name}»)`);
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
await page.getByPlaceholder('Номер, название или вуз').fill('abc');
await page.waitForTimeout(500);
ok((await page.locator('[data-testid="input__suffix__clear"]').first().getAttribute('aria-label')) === 'Очистить', 'кнопка очистки поиска называется «Очистить»');

// 2. тост ошибки → role=alert (настойчиво): удаление причины отказа с подменённым ответом 500 (данные не трогаются)
const admin = await newPage(browser, { who: 'admin' });
await admin.route((u) => u.pathname.startsWith('/api/loss-reasons/'), (r) => (r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Ошибка', status: 500, code: 'CRM-9000' }) })));
await admin.goto(`${BASE}/catalog/loss-reasons`, { waitUntil: 'load' });
await admin.getByRole('button', { name: 'Удалить' }).first().waitFor({ timeout: 15000 });
await admin.evaluate(() => { window.__alerts = []; new MutationObserver(() => { const t = document.querySelector('[role=alert][aria-live=assertive]')?.textContent.trim(); if (t) window.__alerts.push(t); }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
await admin.getByRole('button', { name: 'Удалить' }).first().click();
await admin.locator('[role=dialog]').getByRole('button', { name: 'Удалить' }).last().click();
await admin.waitForTimeout(1500);
const alerts = await admin.evaluate(() => window.__alerts);
ok(alerts.length > 0, `ошибка сервера озвучена сразу через role=alert: «${alerts[0]}»`);
await browser.close();
console.log('живые области: всё в порядке');
