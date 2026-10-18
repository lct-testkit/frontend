// Проверка доступности DOM без зависимостей (axe не подключён: нужна новая зависимость, решает лид).
// Правила: contrast (WCAG 1.4.3 по вычисленным цветам; элементы на градиенте и картинке пропускаются), button-name, link-name,
// input-label, img-alt, duplicate-id, aria-hidden-focusable, tabindex-positive, html-lang.
//   node tools/a11y.mjs [--only /deals,/login] [--themes all] [--roles kam,head,admin] [--update-baseline]
// Нужен живой стенд (как tools/shot.mjs). Допустимое число узлов на «путь тема правило» — tools/a11y-baseline.json (храповик:
// сверх baseline — ошибка, меньше — подсказка снизить). Список страниц — маршруты ролей из tools/routes.mjs без динамических сегментов.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BASE, newBrowser, newPage } from './lib.mjs';
import { routesFor } from './routes.mjs';

const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const only = arg('--only')?.split(',').map((u) => '/' + u.replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, '').replace(/^\/+/, '')) ?? null; // Git Bash переписывает ведущий /
const THEMES = process.argv.includes('--themes') ? ['rtk_default_light', 'rtk_default_dark', 'rtk_purple_light', 'rtk_purple_dark'] : ['rtk_default_light'];
const ROLES = arg('--roles')?.split(',') ?? ['admin']; // у администратора видны все маршруты
const baselineFile = new URL('./a11y-baseline.json', import.meta.url);
const baseline = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : {};

/** выполняется в странице: -> [{ rule, target, info }] */
function scan() {
	const out = [];
	const id = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + [...el.classList].slice(0, 2).map((c) => '.' + c).join('');
	const visible = (el) => {
		const r = el.getBoundingClientRect();
		const s = getComputedStyle(el);
		return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
	};
	const hidden = (el) => !!el.closest('[aria-hidden="true"],[hidden],[inert]');
	const named = (el) =>
		!!(el.getAttribute('aria-label') || el.getAttribute('title') || (el.innerText || el.textContent || '').trim()) ||
		[...el.querySelectorAll('img[alt],[aria-label]')].some((x) => (x.getAttribute('alt') || x.getAttribute('aria-label') || '').trim()) ||
		!!(el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim());
	if (!document.documentElement.lang) out.push({ rule: 'html-lang', target: 'html' });
	for (const el of document.querySelectorAll('button,[role=button]')) if (visible(el) && !hidden(el) && !named(el)) out.push({ rule: 'button-name', target: id(el) });
	for (const el of document.querySelectorAll('a[href]')) if (visible(el) && !hidden(el) && !named(el)) out.push({ rule: 'link-name', target: id(el) });
	for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea')) {
		if (!visible(el) || hidden(el)) continue;
		if (!(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title)) out.push({ rule: 'input-label', target: id(el) });
	}
	for (const el of document.querySelectorAll('img')) {
		if (visible(el) && !hidden(el) && el.getAttribute('alt') === null && el.getAttribute('role') !== 'presentation') out.push({ rule: 'img-alt', target: id(el) });
	}
	const seen = new Map();
	for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
	for (const [k, n] of seen) if (n > 1) out.push({ rule: 'duplicate-id', target: '#' + k });
	for (const el of document.querySelectorAll('[aria-hidden="true"] a[href],[aria-hidden="true"] button,[aria-hidden="true"] input,[aria-hidden="true"] [tabindex]')) {
		if (el.tabIndex >= 0 && !el.disabled && visible(el) && !el.closest('[inert]')) out.push({ rule: 'aria-hidden-focusable', target: id(el) });
	}
	for (const el of document.querySelectorAll('[tabindex]')) if (+el.getAttribute('tabindex') > 0) out.push({ rule: 'tabindex-positive', target: id(el) });
	// контраст
	const parse = (s) => {
		const m = s.match(/[\d.]+/g)?.map(Number);
		return m ? { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } : null;
	};
	const lin = (c) => {
		c /= 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
	const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
	const bgOf = (el) => {
		const layers = [];
		for (let e = el; e; e = e.parentElement) {
			const s = getComputedStyle(e);
			if (s.backgroundImage !== 'none') return null;
			const c = parse(s.backgroundColor);
			if (c && c.a > 0) {
				layers.push(c);
				if (c.a === 1) break;
			}
		}
		let base = { r: 255, g: 255, b: 255, a: 1 };
		for (const l of layers.reverse()) base = over(l, base);
		return base;
	};
	const opacityOf = (el) => {
		let o = 1;
		for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity;
		return o;
	};
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	const done = new Set();
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const el = n.parentElement;
		if (!el || done.has(el) || !n.textContent.trim() || !visible(el) || hidden(el)) continue;
		if (el.closest('script,style,svg,[disabled],[aria-disabled="true"],.svelte-flow__renderer')) continue;
		done.add(el);
		const s = getComputedStyle(el);
		const bg = bgOf(el);
		const fg = parse(s.color);
		if (!bg || !fg) continue;
		const f = over({ ...fg, a: fg.a * opacityOf(el) }, bg);
		const [hi, lo] = [lum(f), lum(bg)].sort((p, q) => q - p);
		const ratio = (hi + 0.05) / (lo + 0.05);
		const px = parseFloat(s.fontSize);
		const bold = +s.fontWeight >= 700;
		const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
		if (ratio < need - 0.005) out.push({ rule: 'contrast', target: id(el), info: `${ratio.toFixed(2)} < ${need} «${n.textContent.trim().slice(0, 24)}»` });
	}
	return out;
}

const browser = await newBrowser();
const found = {};
const report = [];
for (const who of ROLES) {
	const routes = await routesFor(who);
	const list = (Array.isArray(routes) ? routes : (routes.routes ?? [])).map((r) => r.path ?? r).filter((p) => !p.includes('['));
	for (const path of list) {
		if (only && !only.includes(path)) continue;
		for (const theme of THEMES) {
			const page = await newPage(browser, { who, theme });
			try {
				await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
				await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => {});
				await page.waitForTimeout(500);
				const res = await page.evaluate(scan);
				const byRule = {};
				for (const r of res) (byRule[r.rule] ??= []).push(r);
				for (const [rule, items] of Object.entries(byRule)) {
					const key = `${path} ${theme} ${rule}`;
					found[key] = Math.max(found[key] ?? 0, items.length);
					report.push({ key, who, nodes: items.length, allowed: baseline[key] ?? 0, sample: items.slice(0, 3) });
				}
			} catch (e) {
				console.error(`${who} ${path}: ${e.message}`);
			}
			await page.context().close();
		}
	}
}
await browser.close();

if (process.argv.includes('--update-baseline')) {
	writeFileSync(baselineFile, JSON.stringify(Object.fromEntries(Object.entries(found).sort()), null, '\t') + '\n');
	console.log(`baseline: ${Object.keys(found).length} записей`);
	process.exit(0);
}
mkdirSync('.shots/a11y', { recursive: true });
writeFileSync('.shots/a11y/report.json', JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.nodes > r.allowed);
for (const r of report) console.log(`${r.nodes > r.allowed ? 'FAIL' : 'ok  '} ${r.key} x${r.nodes} (допустимо ${r.allowed}) ${r.sample.map((s) => `${s.target} ${s.info ?? ''}`).join(' | ')}`);
const better = Object.keys(baseline).filter((k) => (found[k] ?? 0) < baseline[k]);
if (better.length) console.log(`можно снизить baseline: ${better.length} записей (--update-baseline)`);
console.log(`нарушений сверх baseline: ${bad.length}`);
process.exit(bad.length ? 1 : 0);
