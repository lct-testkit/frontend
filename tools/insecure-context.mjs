// Проверка небезопасного контекста: приложение по plain-http на адресе, который не localhost (нет crypto.randomUUID / crypto.subtle / navigator.clipboard).
//   APP_URL=http://192.168.0.10:5281 node tools/insecure-context.mjs [--out dir]
// 1) вход демо-ролью работает; 2) создание сущности (организация) уходит с X-Request-Id и Idempotency-Key, без TypeError в консоли.
import { mkdir } from 'node:fs/promises';
import { BASE, newBrowser } from './lib.mjs';

const i = process.argv.indexOf('--out');
const out = i > -1 ? process.argv[i + 1] : '.shots/insecure';
await mkdir(out, { recursive: true });

const browser = await newBrowser();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && /TypeError|randomUUID|subtle|clipboard/.test(m.text()) && errors.push(`console: ${m.text()}`));
const posts = [];
page.on('request', (r) => r.method() === 'POST' && r.url().includes('/api/') && posts.push({ url: r.url(), id: r.headers()['x-request-id'], idem: r.headers()['idempotency-key'] }));

await page.goto(`${BASE}/login`);
const env = await page.evaluate(() => ({ secure: isSecureContext, randomUUID: typeof crypto.randomUUID, subtle: typeof crypto.subtle, clipboard: typeof navigator.clipboard }));
console.log('env', JSON.stringify(env));
await page.click('[data-testid="demo-account-kam.ivanov"]');
await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 15000 });
console.log('login ok ->', new URL(page.url()).pathname);

await page.goto(`${BASE}/organizations`);
await page.waitForTimeout(1500);
const create = page.getByRole('button', { name: /Новая организация|Создать организацию|Добавить организацию/i }).first();
if (await create.count()) {
	await create.click();
	await page.waitForTimeout(800);
	await page.screenshot({ path: `${out}/org-drawer.png` });
	await page.getByRole('button', { name: 'Заполнить вручную' }).click();
	await page.waitForTimeout(500);
	await page.locator('[role=dialog] input, aside input').nth(1).fill(`Тест http ${Date.now() % 100000}`);
	await page.screenshot({ path: `${out}/org-form.png` });
	await page.click('[data-testid="org-create-submit"]');
	await page.waitForTimeout(2000);
} else console.log('кнопка создания организации не найдена');
await page.screenshot({ path: `${out}/after-create.png` });
console.log('POST:', JSON.stringify(posts));
console.log(errors.length ? `ОШИБКИ:\n${errors.join('\n')}` : 'без TypeError в консоли');
await browser.close();
process.exit(errors.length || !posts.some((p) => p.id) ? 1 : 0);
