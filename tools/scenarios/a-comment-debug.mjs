import { BASE, accessToken } from '../lib.mjs';
import { newBrowser, newPage } from './a-lib.mjs';
const tok = await accessToken('kam');
const deal = (await (await fetch(`${BASE}/api/deals?q=D-2026-000002&limit=1`, { headers: { Authorization: `Bearer ${tok}` } })).json()).items[0];
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam' });
page.on('request', (r) => r.url().includes('comments') && console.log('REQ', r.method(), r.url().replace(BASE, '')));
page.on('response', (r) => r.url().includes('comments') && console.log('RES', r.status(), r.url().replace(BASE, '')));
await page.goto(`${BASE}/deals/${deal.id}?tab=comments`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.locator('textarea').first().fill('Отладка отправки');
await page.waitForTimeout(300);
const state = async () => page.getByTestId('comment-send').evaluate((b) => ({ disabled: b.disabled, busy: b.getAttribute('aria-busy') }));
console.log('до клика', JSON.stringify(await state()));
await page.getByTestId('comment-send').click({ timeout: 5000 }).catch((e) => console.log('click fail', e.message.slice(0, 80)));
for (let i = 0; i < 5; i += 1) { await page.waitForTimeout(600); console.log('после', i, JSON.stringify(await state()), 'textarea:', JSON.stringify(await page.locator('textarea').first().inputValue())); }
await browser.close();
