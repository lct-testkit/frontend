// The routes of the app for one role: every +page.svelte of src/routes, dynamic segments filled from the live API (the first record the role can see).
// Shared by qa-all.mjs (layout audit) and buttons.mjs (every button of every screen).
import { readdir } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, accessToken } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function walk(dir) {
	const out = [];
	for (const e of await readdir(dir, { withFileTypes: true })) {
		const full = resolve(dir, e.name);
		if (e.isDirectory()) out.push(...(await walk(full)));
		else if (e.name === '+page.svelte') out.push(full);
	}
	return out;
}

/** Route patterns of the app, e.g. `/deals/[id]`; the dev-only catalog is left out. */
export async function routePatterns() {
	const base = resolve(root, 'src/routes');
	return (await walk(base))
		.map((f) => '/' + relative(base, dirname(f)).split(sep).filter((seg) => !/^\(.+\)$/.test(seg)).join('/'))
		.filter((p) => !p.startsWith('/dev'))
		.sort();
}

const tokens = {};
async function first(token, path, pick = (x) => x.id) {
	try {
		const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
		const j = await r.json();
		const items = Array.isArray(j) ? j : j.items;
		return items?.[0] ? pick(items[0]) : null;
	} catch {
		return null;
	}
}

// dynamic params through the API, with the token of the role that will open the page (scopes differ: a KAM sees only own deals)
const RESOLVERS = {
	'/deals/[id]': (t) => first(t, '/api/deals?limit=1'),
	'/organizations/[id]': (t) => first(t, '/api/organizations?limit=1'),
	'/contacts/[id]': (t) => first(t, '/api/contacts?limit=1'),
	'/workflows/[id]': (t) => first(t, '/api/workflows?limit=1'),
	'/admin/users/[id]': (t) => first(t, '/api/admin/users?limit=1'),
	'/admin/erasure/[id]': (t) => first(t, '/api/admin/erasure-requests?limit=1'),
	'/imports/[id]': (t) => first(t, '/api/imports?limit=1'),
	'/admin/users/[id]/offboard': (t) => first(t, '/api/admin/users?limit=1'),
	'/reports/dashboards/[id]': (t) => first(t, '/api/dashboards?limit=1'),
	'/signing/[id]': async (t) => {
		const deal = await first(t, '/api/deals?limit=1');
		return deal ? first(t, `/api/signature-documents?entity_type=deal&entity_id=${deal}`) : null;
	}
};

/**
 * Concrete routes for a role. `/login` redirects signed-in users by design (checked separately by lead-session / lead-prod-login).
 * @returns {{ routes: string[], skipped: string[] }} skipped = dynamic routes without data or without a resolver
 */
export async function routesFor(who, only = null) {
	tokens[who] ??= await accessToken(who);
	const routes = [];
	const skipped = [];
	for (const p of await routePatterns()) {
		if (p === '/login') continue;
		if (!p.includes('[')) {
			routes.push(p || '/');
			continue;
		}
		const value = RESOLVERS[p] ? await RESOLVERS[p](tokens[who]) : null;
		if (value) routes.push(p.replace(/\[\[?[a-z_]+\]?\]/, value));
		else skipped.push(p);
	}
	return { routes: routes.filter((r) => !only || r.startsWith(only)), skipped };
}
