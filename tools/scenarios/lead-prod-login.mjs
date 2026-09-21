// PROD-mode check: anonymous → /login (no demo accounts) → Keycloak → cookie session → app; then logout.
// The page is served the same static bundle; only /config.json is swapped to mode=prod inside the browser context.
import { BASE, newBrowser } from '../lib.mjs';

const browser = await newBrowser();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ru-RU' });
await context.route('**/config.json', (route) =>
	route.fulfill({ json: { mode: 'prod', appName: 'CRM ИТ Школы', keycloak: { path: '/auth', realm: 'crm', clientId: 'crm-bff' }, demoAccounts: [] } })
);
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(String(e)));
page.on('response', (r) => r.status() >= 500 && problems.push(`${r.status()} ${r.url()}`));

await page.goto(`${BASE}/`);
await page.waitForURL(/\/login/, { timeout: 15000 });
console.log('1. anonymous / → redirected to', new URL(page.url()).pathname + new URL(page.url()).search);
const demoCards = await page.locator('[data-testid^=demo-account-]').count();
const oidcBtn = await page.locator('[data-testid=oidc-login]').count();
console.log(`2. demo account cards: ${demoCards} (want 0) · sign-in button: ${oidcBtn} (want 1)`);
await page.screenshot({ path: '.shots/lead/prod-login.png' });

await page.click('[data-testid=oidc-login]');
await page.waitForURL(/\/auth\/realms\/crm/, { timeout: 15000 });
console.log('3. redirected to Keycloak:', new URL(page.url()).pathname);
await page.fill('#username', 'admin.crm');
await page.fill('#password', 'Admin12345678!');
await page.click('#kc-login');
await page.waitForURL(`${BASE}/**`, { timeout: 20000 });
console.log('4. back in the app:', page.url().replace(BASE, ''));
await page.waitForSelector('.atmr-side-menu, [data-testid=consent-accept]', { timeout: 15000 });
if (await page.locator('[data-testid=consent-accept]').count()) {
	console.log('5. consent dialog shown → accepting');
	await page.click('[data-testid=consent-accept]');
	await page.waitForSelector('.atmr-side-menu', { timeout: 10000 });
}
const cookies = (await context.cookies()).map((c) => `${c.name}${c.httpOnly ? '(httpOnly)' : ''}`);
console.log('6. cookies:', cookies.join(', '));
const me = await page.evaluate(async () => (await fetch('/api/me')).status);
console.log('7. GET /api/me with cookie session →', me);
const csrf = await page.evaluate(async () => {
	const token = document.cookie.match(/crm_csrf=([^;]+)/)?.[1];
	const withCsrf = await fetch('/api/me/consent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token ?? '' }, body: '{}' });
	const without = await fetch('/api/me/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
	return { withCsrf: withCsrf.status, without: without.status };
});
console.log('8. mutating POST: with CSRF header →', csrf.withCsrf, '(422 = passed CSRF, body invalid) · without →', csrf.without, '(403 = blocked)');
await page.screenshot({ path: '.shots/lead/prod-after-login.png' });

await page.click('[data-testid=user-menu]');
await page.getByText('Выйти').click();
await page.waitForURL(/\/login/, { timeout: 15000 });
const meAfter = await page.evaluate(async () => (await fetch('/api/me')).status);
console.log('9. after logout: /login shown, GET /api/me →', meAfter, '(want 401)');
console.log(problems.length ? `PROBLEMS: ${problems.join(' | ')}` : 'no page errors / 5xx');
await browser.close();
