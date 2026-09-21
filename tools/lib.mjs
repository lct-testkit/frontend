// Shared helpers for Playwright checks (uses the system Chrome/Edge — no browser download needed).
import { chromium } from 'playwright';

export const BASE = process.env.APP_URL || 'http://localhost:5273';
export const ACCOUNTS = {
	kam: { username: 'kam.ivanov', password: 'Kam123456789!' },
	head: { username: 'head.petrov', password: 'Head12345678!' },
	admin: { username: 'admin.crm', password: 'Admin12345678!' },
	admin2: { username: 'admin.volkov', password: 'Volkov12345678!' },
	auditor: { username: 'auditor.smirnov', password: 'Audit12345678!' }
};

export const SIZES = {
	desktop: [1440, 900],
	laptop: [1280, 600],
	'tablet-l': [1024, 768],
	'tablet-p': [768, 1024],
	phone: [390, 844],
	'phone-s': [360, 640],
	'phone-l': [844, 390]
};
export const ALL_SIZES = ['desktop', 'tablet-l', 'tablet-p', 'phone', 'phone-s', 'phone-l'];

export async function newBrowser() {
	return chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
}

async function tokensFor(who) {
	const account = ACCOUNTS[who];
	if (!account) throw new Error(`unknown role "${who}" (kam|head|admin|admin2|auditor)`);
	const config = await (await fetch(`${BASE}/config.json`)).json();
	const kc = config.keycloak;
	const body = new URLSearchParams({
		grant_type: 'password',
		client_id: kc.clientId,
		client_secret: kc.clientSecret ?? '',
		scope: 'openid',
		username: account.username,
		password: account.password
	});
	const response = await fetch(`${BASE}${kc.path}/realms/${kc.realm}/protocol/openid-connect/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!response.ok) throw new Error(`login ${who}: HTTP ${response.status} ${await response.text()}`);
	const json = await response.json();
	const now = Date.now();
	return {
		access_token: json.access_token,
		refresh_token: json.refresh_token,
		access_expires_at: now + json.expires_in * 1000,
		refresh_expires_at: now + (json.refresh_expires_in ?? 1800) * 1000,
		username: account.username
	};
}

/** Access token for API calls from scripts (seeding, assertions). */
export async function accessToken(who) {
	return (await tokensFor(who)).access_token;
}

/** Accept the personal-data policy for a role through the API (so screenshots are not covered by the consent dialog). */
export async function ensureConsent(who, tokens) {
	const auth = { Authorization: `Bearer ${tokens.access_token}` };
	const me = await (await fetch(`${BASE}/api/me`, { headers: auth })).json();
	if (!me.consent_required) return;
	const policy = await (await fetch(`${BASE}/api/me/policy`, { headers: auth })).json();
	await fetch(`${BASE}/api/me/consent`, {
		method: 'POST',
		headers: { ...auth, 'Content-Type': 'application/json' },
		body: JSON.stringify({ policy_version: policy.version, policy_text_hash: policy.text_hash ?? 'a'.repeat(64) })
	});
}

/**
 * A page that is already signed in as `who` (kam|head|admin|admin2|auditor|null for anonymous) at the given viewport.
 * Collects console errors and failed requests into page.__problems.
 */
export async function newPage(browser, { who = null, width = 1440, height = 900, theme = 'rtk_default_light', dpr = 1 } = {}) {
	const touch = width < 768 || height < 500;
	const context = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: dpr,
		locale: 'ru-RU',
		hasTouch: touch,
		isMobile: touch
	});
	if (who) {
		const tokens = await tokensFor(who);
		await ensureConsent(who, tokens);
		await context.addInitScript(
			([key, value, themeKey, themeValue]) => {
				// only seed a fresh context: tests that change the stored tokens and reload must see their own values
				if (!localStorage.getItem(key)) localStorage.setItem(key, value);
				if (!localStorage.getItem(themeKey)) localStorage.setItem(themeKey, themeValue);
			},
			['rtk.demo.tokens', JSON.stringify(tokens), 'rtk.theme', theme]
		);
	} else {
		await context.addInitScript(([k, v]) => localStorage.setItem(k, v), ['rtk.theme', theme]);
	}
	const page = await context.newPage();
	page.__problems = { console: [], pageerrors: [], failed: [] };
	page.on('console', (msg) => {
		if (msg.type() === 'error') page.__problems.console.push(msg.text().slice(0, 300));
	});
	page.on('pageerror', (err) => page.__problems.pageerrors.push(String(err).slice(0, 300)));
	page.on('response', (res) => {
		const status = res.status();
		const url = res.url();
		if (status >= 400 && !url.includes('favicon')) page.__problems.failed.push(`${status} ${res.request().method()} ${url.replace(BASE, '')}`);
	});
	return page;
}

/** Layout audit: horizontal scroll of the page/content and elements sticking out of the viewport. */
export async function auditLayout(page) {
	return page.evaluate(() => {
		const vw = document.documentElement.clientWidth;
		const scrollers = [document.scrollingElement, document.querySelector('main#content')].filter(Boolean);
		const hscroll = scrollers.some((el) => el.scrollWidth > el.clientWidth + 1);
		const offenders = [];
		for (const el of document.querySelectorAll('body *')) {
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.height === 0) continue;
			if (r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
				// ignore anything inside an element that scrolls horizontally on purpose
				let p = el.parentElement;
				let scrolls = false;
				while (p && p !== document.body) {
					const ox = getComputedStyle(p).overflowX;
					if ((ox === 'auto' || ox === 'scroll' || ox === 'hidden') && p.getBoundingClientRect().right <= vw + 1) {
						scrolls = true;
						break;
					}
					p = p.parentElement;
				}
				if (!scrolls) offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} right=${Math.round(r.right)}`);
			}
			if (offenders.length >= 6) break;
		}
		// a table that does not fit scrolls inside itself (not a page problem, but its last columns are cut off)
		const tableScroll = [...document.querySelectorAll('.atmr-tablegrid__layout')].some((el) => el.scrollWidth > el.clientWidth + 1);
		return { viewport: vw, hscroll, offenders, tableScroll };
	});
}
