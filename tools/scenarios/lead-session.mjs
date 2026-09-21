// Session behaviour: (1) demo — expired access token is refreshed silently; (2) prod — a dead session sends the user to /login with a notice.
import { BASE, newBrowser, newPage } from '../lib.mjs';

const browser = await newBrowser();

// ---- demo: silent refresh
{
	const page = await newPage(browser, { who: 'kam' });
	await page.goto(BASE + '/');
	await page.waitForSelector('.atmr-side-menu');
	const before = await page.evaluate(() => JSON.parse(localStorage.getItem('rtk.demo.tokens')).access_token);
	// make the stored access token look expired, then reload so the in-memory copy is re-read
	await page.evaluate(() => {
		const t = JSON.parse(localStorage.getItem('rtk.demo.tokens'));
		t.access_expires_at = Date.now() - 1000;
		localStorage.setItem('rtk.demo.tokens', JSON.stringify(t));
	});
	const bad = [];
	page.on('response', (r) => r.url().includes('/api/') && r.status() === 401 && bad.push(r.url()));
	await page.reload();
	await page.waitForSelector('.atmr-side-menu', { timeout: 15000 });
	const after = await page.evaluate(() => JSON.parse(localStorage.getItem('rtk.demo.tokens')).access_token);
	console.log(`demo refresh: token rotated = ${before !== after} · 401 responses = ${bad.length} · shell rendered = true`);
	await page.context().close();
}

// ---- prod: dead cookie session
{
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	await context.route('**/config.json', (route) => route.fulfill({ json: { mode: 'prod', appName: 'CRM', keycloak: { path: '/auth', realm: 'crm', clientId: 'crm-bff' }, demoAccounts: [] } }));
	const page = await context.newPage();
	await page.goto(BASE + '/login');
	await page.click('[data-testid=oidc-login]');
	await page.waitForURL(/\/auth\/realms\/crm/);
	await page.fill('#username', 'head.petrov');
	await page.fill('#password', 'Head12345678!');
	await page.click('#kc-login');
	await page.waitForSelector('.atmr-side-menu, [data-testid=consent-accept]', { timeout: 20000 });
	if (await page.locator('[data-testid=consent-accept]').count()) {
		await page.click('[data-testid=consent-accept]');
		await page.waitForSelector('.atmr-side-menu');
	}
	console.log('prod: signed in as', await page.locator('[data-testid=user-menu]').innerText().then((t) => t.split('\n')[0]));
	// kill the server session cookie, then do something that calls the API
	await context.clearCookies({ name: 'crm_sid' });
	await page.getByRole('button', { name: 'Обновить' }).click().catch(() => {});
	await page.waitForURL(/\/login/, { timeout: 15000 });
	const notice = await page.locator('[role=status]').first().innerText().catch(() => '(none)');
	console.log('prod: dead session → /login, notice:', JSON.stringify(notice));
	await context.close();
}
await browser.close();
