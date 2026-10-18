// Страница, уже «вошедшая» под ролью на мок-стенде: токены вымышленные (срок сутки, Keycloak не спрашивается), ответы API — из stand.mjs.
import { BASE, newBrowser } from '../lib.mjs';
import { installMock } from './stand.mjs';

export { newBrowser };

const USERNAMES = { kam: 'kam.ivanov', head: 'head.petrov', admin: 'admin.crm', auditor: 'auditor.smirnov' };

/**
 * `newMockPage(browser, 'admin', { mode, delayMs, overrides, width, height, theme })` → Playwright Page с `__problems` ({ console, pageerrors, failed })
 * и `__mockCalls` (все запросы к API).
 */
export async function newMockPage(browser, role = 'admin', { mode = 'ok', delayMs = 0, overrides = [], width = 1440, height = 900, theme = 'rtk_default_light' } = {}) {
	if (!USERNAMES[role]) throw new Error(`unknown role "${role}" (${Object.keys(USERNAMES).join('|')})`);
	const touch = width < 768 || height < 500;
	const context = await browser.newContext({ viewport: { width, height }, locale: 'ru-RU', hasTouch: touch, isMobile: touch });
	const day = 24 * 3600 * 1000;
	const now = Date.now();
	const tokens = { access_token: 'mock.access', refresh_token: 'mock.refresh', access_expires_at: now + day, refresh_expires_at: now + day, username: USERNAMES[role] };
	await context.addInitScript(
		([key, value, themeKey, themeValue]) => {
			if (!localStorage.getItem(key)) localStorage.setItem(key, value);
			if (!localStorage.getItem(themeKey)) localStorage.setItem(themeKey, themeValue);
		},
		['rtk.demo.tokens', JSON.stringify(tokens), 'rtk.theme', theme]
	);
	const page = await context.newPage();
	page.__problems = { console: [], pageerrors: [], failed: [] };
	page.on('console', (msg) => {
		if (msg.type() === 'error') page.__problems.console.push(msg.text().slice(0, 300));
	});
	page.on('pageerror', (err) => page.__problems.pageerrors.push(String(err).slice(0, 300)));
	page.on('response', (res) => {
		const status = res.status();
		if (status >= 400 && !res.url().includes('favicon')) page.__problems.failed.push(`${status} ${res.request().method()} ${res.url().replace(BASE, '')}`);
	});
	await installMock(page, { mode, role, delayMs, overrides });
	return page;
}
