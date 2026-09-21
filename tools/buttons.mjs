// Every button of every screen. Opens each route as a role, presses every button, link, tab, menu item, switch and checkbox it finds — and everything
// inside the panels, menus and windows those open (three levels deep) — and writes down what happened: went to a page, opened a window, sent a request,
// changed the page, or did nothing.
//   node tools/buttons.mjs --as kam,head,admin,auditor [--size desktop] [--only /deals] [--out .shots/buttons] [--inventory]
// Nothing is changed on the server: every POST/PUT/PATCH/DELETE to /api, /auth (except the token refresh) and the file storage is answered by the
// script itself with a stub «ok», so even a confirm button can be pressed for real — the script only records which request the button sends.
// Reads (GET) go to the real backend. Output: <out>/<role>-<size>.jsonl (one line per element) — read it with tools/buttons-report.mjs.
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { BASE, SIZES, newBrowser, newPage } from './lib.mjs';
import { routesFor } from './routes.mjs';

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
const PER_SIG = Number(opt('per-sig', 2)); // of many alike (25 rows, 25 links to deals) only the first N are pressed
const BUDGET_MS = Number(opt('budget', 300)) * 1000; // per route
const MAX_DEPTH = 3;
const INNER_CAP = [0, 0, 26, 10]; // how many elements are pressed inside a window of depth 2 and 3

// ---------------------------------------------------------------------------------------------------- in the page
/** Runs in the page (addInitScript). Collects the clickable elements of the page or of a window, watches the DOM, lists the open windows. */
function install() {
	const SEL = [
		'button', 'a[href]', '[role=button]', '[role=tab]', '[role=menuitem]', '[role=menuitemcheckbox]', '[role=menuitemradio]', '[role=option]',
		'[role=switch]', '[role=checkbox]', '[role=radio]', '[role=combobox]', '[role=link]', '[role=treeitem]', 'summary',
		'label:has(input[type=checkbox])', 'label:has(input[type=radio])'
	].join(',');
	const stats = { child: 0, text: 0, attr: 0, cls: 0 };
	new MutationObserver((records) => {
		for (const m of records) {
			if (m.type === 'childList') stats.child += m.addedNodes.length + m.removedNodes.length;
			else if (m.type === 'characterData') stats.text++;
			else {
				const a = m.attributeName || '';
				if (a === 'style' || a === 'tabindex' || a.startsWith('data-btn')) continue;
				if (a === 'class') stats.cls++;
				else stats.attr++;
			}
		}
	}).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });

	const text = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
	const nameOf = (el) => {
		const aria = el.getAttribute('aria-label');
		if (aria) return aria.trim();
		const by = el.getAttribute('aria-labelledby');
		if (by) {
			const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
			if (t) return t;
		}
		const t = text(el);
		if (t) return t;
		const title = el.getAttribute('title');
		if (title) return title.trim();
		return el.querySelector('img[alt]')?.getAttribute('alt')?.trim() || el.querySelector('svg title')?.textContent?.trim() || '';
	};
	const visible = (el) => {
		const r = el.getBoundingClientRect();
		if (r.width < 1 || r.height < 1) return false;
		if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
		return true;
	};
	const layerKind = (el) => {
		const cls = String(el.className || '');
		const role = el.getAttribute('role') || '';
		if (/atmr-tooltip/.test(cls)) return null;
		if (/atmr-drawer/.test(cls)) return 'drawer';
		if (/atmr-modal/.test(cls) || role === 'dialog' || role === 'alertdialog') return 'modal';
		if (/atmr-dropdown-menu(?!-root)/.test(cls) || role === 'menu' || role === 'listbox') return 'menu';
		if (/atmr-popover(?!__)/.test(cls)) return 'popover';
		return null;
	};
	let seq = 0;
	const layers = () => {
		const found = new Set();
		for (const el of document.body.children) if (layerKind(el)) found.add(el);
		for (const el of document.querySelectorAll('[role=dialog],[role=alertdialog],[role=menu],[role=listbox]')) if (layerKind(el)) found.add(el);
		const out = [];
		for (const el of found) {
			if (!visible(el)) continue;
			if (!el.dataset.btnlayer) el.dataset.btnlayer = String(++seq);
			const head = el.querySelector('h1,h2,h3,h4,[class*=title]');
			out.push({
				id: el.dataset.btnlayer,
				kind: layerKind(el),
				name: (el.getAttribute('aria-label') || (head ? text(head) : '') || '').slice(0, 70),
				items: el.querySelectorAll('[role=option],[role=menuitem],li').length,
				buttons: [...el.querySelectorAll('button')].filter(visible).map((b) => nameOf(b)).filter(Boolean).slice(0, 12)
			});
		}
		return out;
	};
	const area = (el) => {
		if (el.closest('[data-btnlayer]')) return 'layer';
		if (!el.closest('main')) return 'shell';
		if (el.closest('table,[role=table],[role=grid],[role=row],tr')) return 'table';
		if (el.closest('[role=tablist]')) return 'tabs';
		return 'page';
	};
	const hrefSig = (h) => h.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').replace(/\/\d+/g, '/:n');

	/** The clickable elements of the page (layerId = null) or of one window; every element gets data-btnaudit=<idx> so the script can press it. */
	const collect = (layerId, perSig, deep) => {
		const root = layerId ? document.querySelector(`[data-btnlayer="${layerId}"]`) : document.body;
		if (!root) return { items: [], dropped: 0 };
		document.querySelectorAll('[data-btnaudit]').forEach((e) => e.removeAttribute('data-btnaudit'));
		const occurrence = new Map();
		const perSigCount = new Map();
		const items = [];
		let dropped = 0;
		const seen = new Set();
		const consider = (el, nonsemantic) => {
			if (seen.has(el)) return;
			seen.add(el);
			if (!layerId && el.closest('[data-btnlayer]')) return;
			if (!visible(el)) return;
			const name = nameOf(el);
			const href = el.getAttribute('href') || '';
			const tag = el.tagName.toLowerCase();
			const role = el.getAttribute('role') || '';
			const key0 = `${tag}|${role}|${name}|${href}|${nonsemantic ? 'ns' : ''}`;
			const nth = occurrence.get(key0) ?? 0;
			occurrence.set(key0, nth + 1);
			const sig = `${tag}|${role}|${href ? hrefSig(href) : name.replace(/\d+/g, '#').slice(0, 40)}|${area(el)}`;
			const count = perSigCount.get(sig) ?? 0;
			perSigCount.set(sig, count + 1);
			if (count >= perSig) {
				dropped++;
				return;
			}
			const idx = items.length;
			el.setAttribute('data-btnaudit', String(idx));
			const inControl = el.closest('.atmr-input__container,.atmr-select,.atmr-multiselect,.atmr-input-date');
			items.push({
				idx,
				key: `${key0}|${nth}`,
				tag,
				role,
				type: el.getAttribute('type') || '',
				name,
				href,
				target: el.getAttribute('target') || '',
				rel: el.getAttribute('rel') || '',
				download: el.hasAttribute('download'),
				disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true' || !!el.closest('fieldset:disabled'),
				title: el.getAttribute('title') || '',
				describedby: !!el.getAttribute('aria-describedby'),
				haspopup: el.getAttribute('aria-haspopup') || '',
				expanded: el.getAttribute('aria-expanded'),
				selected: el.getAttribute('aria-selected'),
				current: el.getAttribute('aria-current'),
				pressed: el.getAttribute('aria-pressed'),
				checked: el.getAttribute('aria-checked') ?? (el.matches('input[type=checkbox],input[type=radio]') ? String(el.checked) : el.querySelector('input[type=checkbox],input[type=radio]') ? String(el.querySelector('input').checked) : null),
				area: area(el),
				select: !!inControl || el.getAttribute('aria-haspopup') === 'listbox' || role === 'combobox',
				cls: [...el.classList].filter((c) => c.startsWith('atmr-')).slice(0, 3).join(' '),
				nonsemantic: !!nonsemantic,
				html: el.outerHTML.replace(/\s+/g, ' ').slice(0, 200)
			});
		};
		for (const el of root.querySelectorAll(SEL)) consider(el, false);
		// clickable without being a button or a link (a div with cursor:pointer): the top-most such element of a group (slow: first look only)
		if (deep) for (const el of root.querySelectorAll('div,span,li,tr,td,p,img,svg,section,article')) {
			if (seen.has(el) || el.closest(SEL)) continue;
			if (getComputedStyle(el).cursor !== 'pointer') continue;
			const parent = el.parentElement;
			if (parent && getComputedStyle(parent).cursor === 'pointer') continue;
			consider(el, true);
		}
		return { items, dropped };
	};
	const toasts = () => [...document.querySelectorAll('[class*="atmr-notification"]')].filter(visible).length;
	const stateOf = (idx) => {
		const el = document.querySelector(`[data-btnaudit="${idx}"]`);
		if (!el) return null;
		const input = el.matches('input') ? el : el.querySelector('input[type=checkbox],input[type=radio]');
		return [el.getAttribute('aria-expanded'), el.getAttribute('aria-pressed'), el.getAttribute('aria-checked'), el.getAttribute('aria-selected'), input ? input.checked : '', el.disabled].join('|');
	};
	window.__ba = { collect, layers, toasts, stateOf, stats: () => ({ ...stats }), reset: () => Object.assign(stats, { child: 0, text: 0, attr: 0, cls: 0 }) };
}

// ---------------------------------------------------------------------------------------------------- the crawler
const STUB = { status: 200, contentType: 'application/json', body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000000', version: 1 }) };
const isApp = (url) => {
	const u = new URL(url);
	return (u.origin === new URL(BASE).origin && /^\/(api|auth|public)\//.test(u.pathname)) || u.port === '8333';
};
const pathOf = (url) => {
	const u = new URL(url);
	return (u.pathname + (u.search ? '?…' : '')).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function crawlRole(browser, who) {
	const [w, h] = SIZES[sizeName];
	const { routes, skipped } = await routesFor(who, only);
	const outFile = `${outDir}/${who}-${sizeName}.jsonl`;
	await mkdir(outDir, { recursive: true });
	await writeFile(outFile, '');
	console.log(`\n=== ${who} · ${sizeName} · ${routes.length} routes${skipped.length ? ` · skipped ${skipped.join(', ')}` : ''}`);

	let page;
	let log = [];
	let inflight = 0;
	let popups = 0;
	let downloads = 0;
	let nativeDialogs = 0;

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
			return route.fulfill(method === 'DELETE' ? { status: 204 } : STUB);
		});
		page.on('request', (req) => {
			inflight++;
			if (isApp(req.url()) && req.method() === 'GET') log.push({ m: 'GET', p: pathOf(req.url()) });
		});
		page.on('requestfinished', () => (inflight = Math.max(0, inflight - 1)));
		page.on('requestfailed', () => (inflight = Math.max(0, inflight - 1)));
		page.on('response', (res) => {
			if (!isApp(res.url()) || res.status() < 400) return;
			log.push({ m: res.request().method(), p: pathOf(res.url()), s: res.status() });
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
		for (let i = 0; i < 14 && inflight > 0; i++) await page.waitForTimeout(150);
		await page.waitForTimeout(extra);
	};
	async function open(route) {
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
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
	const collect = (layerId, deep = true) => page.evaluate(([id, per, d]) => window.__ba.collect(id, per, d), [layerId, PER_SIG, deep]);
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
			await page.locator(`[data-btnaudit="${c.idx}"]`).click({ timeout: 3500 });
		} catch (e) {
			const msg = String(e.message ?? e);
			const blocker = /<([^>]{0,80})>[^<]*intercepts pointer events/.exec(msg);
			res.effect = ['blocked'];
			res.note = blocker ? `covered by <${blocker[1]}>` : /not visible/.test(msg) ? 'not visible' : /not stable/.test(msg) ? 'not stable' : msg.split('\n')[0].slice(0, 100);
			return res;
		}
		await settle();
		const url1 = page.url();
		const u0 = new URL(url0);
		const u1 = new URL(url1);
		if (u0.pathname !== u1.pathname) {
			res.effect.push('nav');
			res.nav = u1.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
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
		if (mut.child + mut.text + mut.attr > 0) res.effect.push('dom');
		else if (mut.cls > 0 && !res.effect.length) res.effect.push('class-only');
		if (!res.effect.length) res.effect.push('none');
		const bad = log.filter((r) => typeof r.s === 'number');
		if (bad.length) res.errors.push(...bad.map((r) => `${r.s} ${r.m} ${r.p}`));
		res.errors.push(...problems.console.slice(counts.c).filter((t) => !t.includes('Failed to load resource')).map((t) => `console: ${t.slice(0, 160)}`));
		res.errors.push(...problems.pageerrors.slice(counts.e).map((t) => `pageerror: ${t.slice(0, 160)}`));
		res.errors = [...new Set(res.errors)].slice(0, 4);
		res.ms = Date.now() - t0;
		return res;
	}

	const emit = async (route, path, depth, c, res) => {
		const row = {
			who, route, depth, area: c.area, tag: c.tag, role: c.role, name: c.name, href: c.href || undefined, disabled: c.disabled || undefined,
			title: c.title || undefined, cls: c.cls || undefined, nonsemantic: c.nonsemantic || undefined, select: c.select || undefined,
			active: c.selected === 'true' || c.current === 'page' || c.current === 'true' || c.pressed === 'true' || undefined,
			effect: res.effect, requests: res.requests.length ? res.requests : undefined, nav: res.nav ?? undefined,
			layer: res.layer ? { kind: res.layer.kind, name: res.layer.name, items: res.layer.items, buttons: res.layer.buttons } : undefined,
			errors: res.errors.length ? res.errors : undefined, note: res.note || undefined, path: path.length ? path : undefined,
			html: res.effect.includes('none') || res.effect.includes('blocked') || !c.name ? c.html : undefined
		};
		await appendFile(outFile, JSON.stringify(row) + '\n');
		stats.total++;
		for (const e of res.effect) stats[e] = (stats[e] ?? 0) + 1;
		return row;
	};

	const stats = { total: 0 };
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

	/** Walk the elements of one window; `path` = keys that lead to it from the page (to open it again when a press closes it). */
	async function exploreLayer(route, path, depth, layer, opener) {
		const closesOnEsc = { ok: null };
		if (depth < MAX_DEPTH && !(opener.select && layer.kind === 'menu')) {
			const { items } = await collect(layer.id);
			const list = items.filter((c) => !(c.area === 'layer' && c.tag === 'label' && c.disabled)).slice(0, INNER_CAP[depth + 1]);
			let current = layer;
			for (const c of list) {
				if (overBudget()) break;
				// still there? a press before may have closed it (save, cancel, a link): open it again
				let alive = (await layers()).find((l) => l.id === current.id);
				if (!alive || pathname() !== new URL(BASE + route, BASE).pathname) {
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
				const row = await emit(route, [...path], depth + 1, f, res);
				if (res.layer) {
					await exploreLayer(route, [...path, c.key], depth + 1, res.layer, f);
					await closeNested(current.id);
				}
				void row;
			}
		}
		// the window must close on Escape
		if (!overBudget()) {
			const still = (await layers()).some((l) => l.id === layer.id);
			if (still) {
				await page.keyboard.press('Escape');
				await page.waitForTimeout(400);
				closesOnEsc.ok = !(await layers()).some((l) => l.id === layer.id);
				if (!closesOnEsc.ok) await appendFile(outFile, JSON.stringify({ who, route, depth, area: 'layer', name: layer.name || layer.kind, effect: ['no-esc'], note: `${layer.kind} does not close on Escape` }) + '\n');
			}
		}
	}
	async function closeNested(keepId) {
		for (let i = 0; i < 3; i++) {
			const open = await layers();
			if (!open.length || (open.length === 1 && open[0].id === keepId) || open.every((l) => l.id === keepId)) return;
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
				await page.locator(`[data-btnaudit="${f.idx}"]`).click({ timeout: 3500 });
			} catch {
				return null;
			}
			await settle();
			const open = await layers();
			top = open[open.length - 1] ?? null;
		}
		return top;
	}

	await makePage();
	let first = true;
	for (const route of routes) {
		deadline = Date.now() + BUDGET_MS;
		const t0 = Date.now();
		const before = stats.total;
		await open(route);
		if (new URL(BASE + route).pathname !== pathname()) {
			await appendFile(outFile, JSON.stringify({ who, route, depth: 0, area: 'route', name: '(route)', effect: ['redirect'], nav: pathname() }) + '\n');
			continue;
		}
		const { items, dropped } = await collect(null);
		const todo = items.filter((c) => withShell || first || c.area !== 'shell');
		for (const c of todo) {
			if (overBudget()) {
				await appendFile(outFile, JSON.stringify({ who, route, depth: 0, area: 'route', name: '(route)', effect: ['truncated'], note: 'route budget exhausted' }) + '\n');
				break;
			}
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
			if (pathname() !== new URL(BASE + route).pathname || (await layers()).length) {
				await closeLayers();
				if (pathname() !== new URL(BASE + route).pathname) await open(route);
			}
			const f = await refind(c.key, null);
			if (!f) {
				await emit(route, [], 1, c, { effect: ['vanished'], requests: [], errors: [] });
				continue;
			}
			const res = await press(f, { layers: await layers() });
			await emit(route, [], 1, f, res);
			if (res.layer) {
				await exploreLayer(route, [c.key], 1, res.layer, f);
				await closeLayers();
			}
			// whatever the press changed (a filter, a stub answer) must not bleed into the next one
			const dirty = res.effect.some((e) => ['nav', 'url-params', 'toast', 'request', 'dom', 'download', 'popup'].includes(e));
			if (dirty || (await layers()).length || pathname() !== new URL(BASE + route).pathname) await open(route);
		}
		first = false;
		console.log(`  ${route.padEnd(46)} ${String(stats.total - before).padStart(4)} elements${dropped ? ` (+${dropped} alike)` : ''}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
	}
	await page.context().close().catch(() => {});
	const dead = stats.none ?? 0;
	console.log(`--- ${who}: ${stats.total} elements · none ${dead} · blocked ${stats.blocked ?? 0} · vanished ${stats.vanished ?? 0} · ${JSON.stringify(stats)}`);
}

const browser = await newBrowser();
try {
	// roles in parallel: one browser context per role
	await Promise