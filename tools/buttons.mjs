// Every button of every screen. Opens each route as a role, presses every button, link, tab, menu item, switch and checkbox it finds — and everything
// inside the panels, menus and windows those open (three levels deep) — and writes down what happened: went to a page, opened a window, sent a request,
// changed the page, or did nothing. Text fields are clicked and typed into (a search that does not react is as dead as a button).
//   node tools/buttons.mjs --as kam,head,admin,auditor [--size desktop] [--only /deals] [--out .shots/buttons] [--workers 3] [--inventory]
// Nothing is changed on the server: every POST/PUT/PATCH/DELETE to /api, /auth (except the token refresh) and the file storage is answered by the
// script itself with a stub «ok» (the last GET answer of the same record when there was one, so the screen gets the shape it expects), which lets even
// a confirm button be pressed for real — the script only records which request the button sends. Reads (GET) go to the real backend.
// Output: <out>/<role>-<size>.jsonl, one line per element — read it with tools/buttons-report.mjs.
// A second-order stub artifact: a button that CREATES something and then polls/opens it (a report run, a signing "view") gets a stub answer
// with a fake id for the create, so the follow-up real GET on that id 404s — a real HTTP status, so `stubWrite` does not catch it. Before
// treating such a row as a bug, open the same action once by hand against the real backend.
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { BASE, SIZES, newBrowser, newPage } from './lib.mjs';
import { routesFor } from './routes.mjs';
import { install } from './buttons-page.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const roles = opt('as', 'kam').split(',');
const sizeName = opt('size', 'desktop');
// Git Bash (MSYS) rewrites a leading "/" into "C:/Program Files/Git/": undo that
const only = opt('only', null)?.replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, '') || null;
const outDir = opt('out', '.shots/buttons');
const inventoryOnly = flag('inventory');
const withShell = flag('shell'); // press the side menu and the top bar on every route (default: on the first route only)
const WORKERS = Number(opt('workers', 3)); // pages of one role that work through the routes together
const PER_SIG = Number(opt('per-sig', 2)); // of many alike (25 rows, 25 links to deals) only the first N are pressed
const BUDGET_MS = Number(opt('budget', 300)) * 1000; // per route
const MAX_DEPTH = 3;
const INNER_CAP = [0, 0, 26, 10]; // how many elements are pressed inside a window of depth 2 and 3

const GENERIC_STUB = JSON.stringify({ id: '00000000-0000-4000-8000-000000000000', version: 1 });
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const isApp = (url) => {
	const u = new URL(url);
	return (u.origin === new URL(BASE).origin && /^\/(api|auth|public)\//.test(u.pathname)) || u.port === '8333';
};
const pathOf = (url) => {
	const u = new URL(url);
	return (u.pathname + (u.search ? '?…' : '')).replace(UUID, ':id');
};
const TEXT_INPUT = (c) => c.tag === 'textarea' || (c.tag === 'input' && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(c.type));
const SAME_PATH = (route) => new URL(BASE + route).pathname;

async function runWorker(browser, who, shared, id) {
	const [w, h] = SIZES[sizeName];
	const { outFile, stats } = shared;

	let page;
	let log = [];
	const pending = new Map();
	const bodies = new Map(); // last GET answers by path: what a stubbed change answers with
	let popups = 0;
	let downloads = 0;
	let nativeDialogs = 0;

	function stubFor(method, url) {
		if (method === 'DELETE') return { status: 204 };
		let path = new URL(url).pathname.replace(/\/+$/, '');
		while (path.length > 1) {
			const body = bodies.get(path);
			if (body) return { status: method === 'POST' ? 201 : 200, contentType: 'application/json', body };
			path = path.slice(0, path.lastIndexOf('/'));
		}
		return { status: method === 'POST' ? 201 : 200, contentType: 'application/json', body: GENERIC_STUB };
	}

	async function makePage() {
		if (page) await page.context().close().catch(() => {});
		page = await newPage(browser, { who, width: w, height: h });
		const context = page.context();
		await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
		await context.addInitScript(install);
		// every change of the server is answered here (the token refresh of Keycloak is the only one that goes through)
		await context.route('**/*', (route) => {
			const request = route.request();
			const method = request.method();
			if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || !isApp(request.url())) return route.continue();
			if (/\/protocol\/openid-connect\/token$/.test(new URL(request.url()).pathname)) return route.continue();
			log.push({ m: method, p: pathOf(request.url()), s: 'stub' });
			return route.fulfill(stubFor(method, request.url()));
		});
		// requests still running (data requests only: a stream or a socket that never ends must not hold the script back)
		page.on('request', (req) => {
			if (['xhr', 'fetch'].includes(req.resourceType())) pending.set(req, { url: req.url(), at: Date.now() });
			if (isApp(req.url()) && req.method() === 'GET') log.push({ m: 'GET', p: pathOf(req.url()) });
		});
		page.on('requestfinished', (req) => pending.delete(req));
		page.on('requestfailed', (req) => pending.delete(req));
		page.on('response', (res) => {
			const request = res.request();
			if (!isApp(res.url())) return;
			if (res.status() >= 400) log.push({ m: request.method(), p: pathOf(res.url()), s: res.status() });
			else if (request.method() === 'GET' && res.status() === 200) {
				res.text().then((text) => {
					if (text.length < 300_000 && text.startsWith('{') && !/^\{\s*"items"\s*:/.test(text)) bodies.set(new URL(res.url()).pathname.replace(/\/+$/, ''), text);
				}).catch(() => {});
			}
		});
		page.on('dialog', (d) => {
			nativeDialogs++;
			d.dismiss().catch(() => {});
		});
		page.on('download', () => downloads++);
		context.on('page', (p) => {
			popups++;
			p.close().catch(() => {});
		});
	}

	const settle = async (extra = 120) => {
		await page.waitForTimeout(260);
		// a request that is older than 4 s belongs to a page that was left (its abort is not always reported): it does not count
		const running = () => [...pending.values()].filter((r) => Date.now() - r.at < 4000).length;
		for (let i = 0; i < 14 && running() > 0; i++) await page.waitForTimeout(150);
		await page.waitForTimeout(extra);
	};
	async function open(route) {
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				pending.clear();
				await page.goto(BASE + route, { waitUntil: 'load' });
				await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
				await page.waitForTimeout(350);
				if (new URL(page.url()).pathname === '/login') {
					// the session ran out (a long crawl): sign in again
					await makePage();
					continue;
				}
				return;
			} catch {
				await page.waitForTimeout(500);
			}
		}
	}
	const ba = (fn, ...a) => page.evaluate(fn, ...a);
	const collect = (layerId, deep = true) => page.evaluate(([lid, per, d]) => window.__ba.collect(lid, per, d), [layerId, PER_SIG, deep]);
	const layers = () => page.evaluate(() => window.__ba.layers());
	const pathname = () => new URL(page.url()).pathname;

	async function refind(key, layerId) {
		const { items } = await collect(layerId, /\|ns\|\d+$/.test(key));
		return items.find((c) => c.key === key) ?? null;
	}

	/** Press one collected element and describe what came of it. */
	async function press(c, before) {
		const problems = page.__problems;
		const counts = { c: problems.console.length, e: problems.pageerrors.length };
		log = [];
		popups = 0;
		downloads = 0;
		nativeDialogs = 0;
		const url0 = page.url();
		const state0 = await ba((i) => window.__ba.stateOf(i), c.idx);
		const layers0 = new Set(before.layers.map((l) => l.id));
		const toasts0 = await ba(() => window.__ba.toasts());
		await ba(() => window.__ba.reset());
		const res = { effect: [], requests: [], layer: null, nav: null, errors: [], note: '' };
		const t0 = Date.now();
		try {
			await page.locator(`[data-btnaudit="${c.idx}"]`).click({ timeout: 3000 });
			if (TEXT_INPUT(c)) {
				await page.keyboard.type('а', { delay: 30 });
				res.typed = true;
			}
		} catch (e) {
			const msg = String(e.message ?? e);
			const blocker = /(<[a-z][^>]{0,200}>)[^<]{0,20}intercepts pointer events/.exec(msg);
			res.effect = ['blocked'];
			res.note = blocker ? `covered by ${blocker[1]}` : /not visible/.test(msg) ? 'not visible' : /not stable/.test(msg) ? 'not stable' : msg.split('\n')[0].slice(0, 100);
			return res;
		}
		await settle(res.typed ? 500 : 120);
		const url1 = page.url();
		const u0 = new URL(url0);
		const u1 = new URL(url1);
		if (u0.pathname !== u1.pathname) {
			res.effect.push('nav');
			res.nav = u1.pathname.replace(UUID, ':id');
		} else if (u0.search !== u1.search || u0.hash !== u1.hash) res.effect.push('url-params');
		const layers1 = await layers();
		const fresh = layers1.filter((l) => !layers0.has(l.id));
		if (fresh.length) {
			res.effect.push('overlay');
			res.layer = fresh[fresh.length - 1];
		}
		const toasts1 = await ba(() => window.__ba.toasts());
		if (toasts1 > toasts0) res.effect.push('toast');
		const state1 = await ba((i) => window.__ba.stateOf(i), c.idx);
		if (state0 !== state1 && state1 !== null && !fresh.length) res.effect.push('state');
		if (downloads) res.effect.push('download');
		if (popups) res.effect.push('popup');
		if (nativeDialogs) res.effect.push('native-dialog');
		const reqs = log.filter((r) => !r.s || r.s === 'stub');
		res.requests = [...new Map(reqs.map((r) => [`${r.m} ${r.p}`, r])).values()].slice(0, 6).map((r) => ({ m: r.m, p: r.p, stub: r.s === 'stub' || undefined }));
		if (res.requests.length) res.effect.push('request');
		const mut = await ba(() => window.__ba.stats());
		// typing into a field changes the field itself: that is not an answer of the page
		const typedOnly = res.typed && !res.effect.length && mut.child + mut.text === 0;
		if (mut.child + mut.text + mut.attr > 0 && !typedOnly) res.effect.push('dom');
		else if (TEXT_INPUT(c) && !res.effect.length) res.effect.push('focus');
		else if (mut.cls > 0 && !res.effect.length) res.effect.push('class-only');
		if (!res.effect.length) res.effect.push('none');
		const bad = log.filter((r) => typeof r.s === 'number');
		res.errors.push(...bad.map((r) => `${r.s} ${r.m} ${r.p}`));
		res.errors.push(...problems.console.slice(counts.c).filter((t) => !t.includes('Failed to load resource')).map((t) => `console: ${t.slice(0, 160)}`));
		res.errors.push(...problems.pageerrors.slice(counts.e).map((t) => `pageerror: ${t.slice(0, 160)}`));
		res.errors = [...new Set(res.errors)].slice(0, 4);
		// a page that trusts the full shape of a write's answer can throw on our generic stub where the real backend never would
		// (the real endpoint always returns the complete record) — mark this so the report can set such rows apart from real bugs
		res.stubWrite = res.requests.some((r) => r.stub && r.m !== 'DELETE');
		res.ms = Date.now() - t0;
		return res;
	}

	const emit = async (route, path, depth, c, res) => {
		const row = {
			who, route, depth, area: c.area, tag: c.tag, role: c.role, name: c.name, href: c.href || undefined, disabled: c.disabled || undefined,
			title: c.title || undefined, cls: c.cls || undefined, nonsemantic: c.nonsemantic || undefined, select: c.select || undefined,
			typed: res.typed || undefined,
			active: c.selected === 'true' || c.current === 'page' || c.current === 'true' || c.pressed === 'true' || undefined,
			effect: res.effect, requests: res.requests.length ? res.requests : undefined, nav: res.nav ?? undefined,
			layer: res.layer ? { kind: res.layer.kind, name: res.layer.name, items: res.layer.items, buttons: res.layer.buttons } : undefined,
			errors: res.errors.length ? res.errors : undefined, stubWrite: res.stubWrite || undefined, note: res.note || undefined, path: path.length ? path : undefined,
			html: res.effect.includes('none') || res.effect.includes('blocked') || !c.name ? c.html : undefined
		};
		await appendFile(outFile, JSON.stringify(row) + '\n');
		stats.total++;
		for (const e of res.effect) stats[e] = (stats[e] ?? 0) + 1;
		return row;
	};
	const note = (row) => appendFile(outFile, JSON.stringify({ who, depth: 0, area: 'route', ...row }) + '\n');

	let deadline = 0;
	const overBudget = () => Date.now() > deadline;

	async function closeLayers() {
		for (let i = 0; i < 4; i++) {
			if (!(await layers()).length) return true;
			await page.keyboard.press('Escape');
			await page.waitForTimeout(350);
		}
		return !(await layers()).length;
	}
	async function closeNested(keepId) {
		for (let i = 0; i < 3; i++) {
			const open = await layers();
			if (!open.length || open.every((l) => l.id === keepId)) return;
			await page.keyboard.press('Escape');
			await page.waitForTimeout(350);
		}
	}
	/** Open the window at the end of `path` again from a fresh page. Returns the window or null. */
	async function replay(path) {
		let top = null;
		for (const key of path) {
			const f = await refind(key, top?.id ?? null);
			if (!f) return null;
			try {
				await page.locator(`[data-btnaudit="${f.idx}"]`).click({ timeout: 3000 });
			} catch {
				return null;
			}
			await settle();
			const open = await layers();
			top = open[open.length - 1] ?? null;
		}
		return top;
	}

	/** Walk the elements of one window; `path` = keys that lead to it from the page (to open it again when a press closes it). */
	async function exploreLayer(route, path, depth, layer, opener) {
		// the list of a field (select) is only listed: the options are the data of the field, not buttons of the screen
		if (depth < MAX_DEPTH && !(opener.select && layer.kind === 'menu')) {
			const { items } = await collect(layer.id);
			const list = items.slice(0, INNER_CAP[depth + 1]);
			let current = layer;
			for (const c of list) {
				if (overBudget()) break;
				// still there? a press before may have closed it (save, cancel, a link): open it again
				const alive = (await layers()).find((l) => l.id === current.id);
				if (!alive || pathname() !== SAME_PATH(route)) {
					await open(route);
					const reopened = await replay(path);
					if (!reopened) break;
					current = reopened;
				}
				const f = await refind(c.key, current.id);
				if (!f) {
					await emit(route, path, depth + 1, c, { effect: ['vanished'], requests: [], errors: [] });
					continue;
				}
				if (f.disabled) {
					await emit(route, path, depth + 1, f, { effect: ['disabled'], requests: [], errors: [] });
					continue;
				}
				const res = await press(f, { layers: await layers() });
				await emit(route, path, depth + 1, f, res);
				if (res.layer) {
					await exploreLayer(route, [...path, c.key], depth + 1, res.layer, f);
					await closeNested(current.id);
				}
			}
		}
		// the window must close on Escape
		if (!overBudget() && (await layers()).some((l) => l.id === layer.id)) {
			await page.keyboard.press('Escape');
			await page.waitForTimeout(400);
			if ((await layers()).some((l) => l.id === layer.id)) {
				await note({ route, depth, name: layer.name || layer.kind, effect: ['no-esc'], note: `${layer.kind} of «${opener.name}» does not close on Escape`, layer: { kind: layer.kind, buttons: layer.buttons } });
			}
		}
	}

	await new Promise((resolve) => setTimeout(resolve, (id - 1) * 900)); // the pages of a role sign in one after another
	await makePage();
	for (let route = shared.queue.shift(); route; route = shared.queue.shift()) {
		deadline = Date.now() + BUDGET_MS;
		const t0 = Date.now();
		const before = stats.total;
		await open(route);
		if (SAME_PATH(route) !== pathname()) {
			await note({ route, name: '(route)', effect: ['redirect'], nav: pathname() });
			continue;
		}
		const { items, dropped } = await collect(null);
		const todo = items.filter((c) => withShell || route === shared.firstRoute || c.area !== 'shell');
		for (const c of todo) {
			if (overBudget()) {
				await note({ route, name: '(route)', effect: ['truncated'], note: 'route budget exhausted' });
				break;
			}
			try {
				if (c.disabled) {
					await emit(route, [], 1, c, { effect: ['disabled'], requests: [], errors: [] });
					continue;
				}
				if (/^(mailto|tel):/.test(c.href) || (/^https?:/.test(c.href) && new URL(c.href).origin !== new URL(BASE).origin)) {
					await emit(route, [], 1, c, { effect: ['external'], requests: [], errors: [], note: c.target === '_blank' && !/noopener/.test(c.rel) ? 'target=_blank without rel=noopener' : '' });
					continue;
				}
				if (inventoryOnly) {
					await emit(route, [], 1, c, { effect: ['listed'], requests: [], errors: [] });
					continue;
				}
				// the page may have moved on: come back to the route
				if (pathname() !== SAME_PATH(route) || (await layers()).length) {
					await closeLayers();
					if (pathname() !== SAME_PATH(route)) await open(route);
				}
				const f = await refind(c.key, null);
				if (!f) {
					await emit(route, [], 1, c, { effect: ['vanished'], requests: [], errors: [] });
					continue;
				}
				const res = await press(f, { layers: await layers() });
				await emit(route, [], 1, f, res);
				if (res.effect.includes('blocked')) {
					// something covers the page (a window the script does not know): start the route again
					await closeLayers();
					await open(route);
					continue;
				}
				if (res.layer) {
					await exploreLayer(route, [c.key], 1, res.layer, f);
					await closeLayers();
				}
				// what the press changed for good (another page, the address, a change sent to the server, a toast) must not bleed into the next one
				const dirty = res.effect.some((e) => ['nav', 'url-params', 'toast', 'download', 'popup'].includes(e)) || res.requests.some((r) => r.stub) || res.typed;
				if (dirty || (await layers()).length || pathname() !== SAME_PATH(route)) await open(route);
			} catch (e) {
				await note({ route, name: c.name, effect: ['crash'], note: String(e.message ?? e).split('\n')[0].slice(0, 160) });
				await makePage();
				await open(route);
			}
		}
		console.log(`  [${who}#${id}] ${route.padEnd(46)} ${String(stats.total - before).padStart(4)} elements${dropped ? ` (+${dropped} alike)` : ''}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
	}
	await page.context().close().catch(() => {});
}

async function crawlRole(browser, who) {
	const { routes, skipped } = await routesFor(who, only);
	const outFile = `${outDir}/${who}-${sizeName}.jsonl`;
	await mkdir(outDir, { recursive: true });
	await writeFile(outFile, '');
	console.log(`\n=== ${who} · ${sizeName} · ${routes.length} routes · ${WORKERS} pages${skipped.length ? ` · skipped ${skipped.join(', ')}` : ''}`);
	const shared = { outFile, stats: { total: 0 }, queue: [...routes], firstRoute: routes[0] };
	await Promise.all(Array.from({ length: WORKERS }, (_, i) => runWorker(browser, who, shared, i + 1)));
	const s = shared.stats;
	console.log(`--- ${who}: ${s.total} elements · none ${s.none ?? 0} · blocked ${s.blocked ?? 0} · vanished ${s.vanished ?? 0} · ${JSON.stringify(s)}`);
}

const browser = await newBrowser();
try {
	await Promise.all(roles.map((who) => crawlRole(browser, who)));
} finally {
	await browser.close();
}
