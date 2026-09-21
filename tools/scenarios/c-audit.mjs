// Журнал аудита: подробности записи и проверка цепочки (агент C).  node tools/scenarios/c-audit.mjs [--size 390x844]
import { BASE, newBrowser, newPage, auditLayout } from '../lib.mjs';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const [w, h] = opt('size', '1440x900').split('x').map(Number);
const out = opt('out', '.shots/c');
const browser = await newBrowser();
const page = await newPage(browser, { who: 'admin', width: w, height: h });
await page.goto(`${BASE}/admin/audit`, { waitUntil: 'load' });
// любая из свежих записей (в журнале «Вход выполнен» уходит вглубь, когда идут другие сценарии)
const entry = page.getByText(/Вход выполнен|Сделка (создана|изменена)/).locator('visible=true').first(); // в скрытом фильтре «Действие» те же названия
await entry.waitFor({ timeout: 15000 });
await entry.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/audit-details-${w}x${h}.png` });
console.log('details', JSON.stringify(await auditLayout(page)));
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.getByTestId('audit-chain').click();
await page.waitForSelector('[data-testid=chain-result]', { timeout: 20000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/audit-chain-${w}x${h}.png` });
console.log('chain', await page.getByTestId('chain-result').getAttribute('data-ok'));
const p = page.__problems;
if (p.pageerrors.length || p.console.length || p.failed.length) console.log('problems:', JSON.stringify(p));
await browser.close();
