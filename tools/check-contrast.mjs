#!/usr/bin/env node
// Контраст токенов тем rt-ui по WCAG 2.x. Без зависимостей.
//   node tools/check-contrast.mjs [--themes <папка>] [--overlay <css>] [--json] [--md] [--check]
// Темы: `.Theme_root_<имя> { --atmr-x: значение; }`, значения: #hex (3/4/6/8), rgb()/rgba(), var(--atmr-y).
// Переопределения приложения (src/lib/styles/a11y-tokens.css) накладываются поверх темы так же, как в браузере.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const THEMES = ['rtk_default_light', 'rtk_default_dark', 'rtk_purple_light', 'rtk_purple_dark'];

export function defaultThemesDir() {
	const pkg = createRequire(import.meta.url).resolve('@lct-testkit/rt-ui/package.json');
	return join(dirname(pkg), 'dist', 'styles', 'themes');
}

/** Токены темы + переопределения приложения для этой темы -> Map(имя -> значение). */
export function loadTokens(themeCss, overlayCss = '') {
	const map = new Map();
	const decl = /(--(?:atmr|app)-[a-z0-9-]+)\s*:\s*([^;}]+)/g;
	for (const m of themeCss.matchAll(decl)) if (!map.has(m[1])) map.set(m[1], m[2].replace(/\/\*[\s\S]*?\*\//g, '').trim());
	map.set('--app-warning-text', 'var(--atmr-warning-default)'); // значение по умолчанию до пакета AA: цвет text-warning в приложении
	for (const m of overlayCss.matchAll(decl)) map.set(m[1], m[2].trim());
	return map;
}

/** Блоки `body.Theme_root_<тема>[, body.Theme_root_<тема>] { ... }` из CSS приложения -> { тема: 'объявления' }. */
export function overlaysFromCss(css) {
	const out = {};
	for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/((?:body\.Theme_root_[a-z_]+\s*,?\s*)+)\{([^}]*)\}/g)) {
		for (const t of m[1].matchAll(/Theme_root_([a-z_]+)/g)) out[t[1]] = (out[t[1]] ?? '') + m[2];
	}
	return out;
}

// ---- разбор цвета: -> { r, g, b, a } (0..255, a 0..1) ----
function parse(value, tokens, depth = 0) {
	if (depth > 20) throw new Error('цикл var(): ' + value);
	const v = value.trim();
	let m;
	if ((m = v.match(/^var\((--[a-z0-9-]+)\)$/))) {
		const next = tokens.get(m[1]);
		if (next == null) throw new Error('нет токена ' + m[1]);
		return parse(next, tokens, depth + 1);
	}
	if ((m = v.match(/^#([0-9a-f]{3,8})$/i))) {
		let h = m[1];
		if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
		return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
	}
	if ((m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/))) {
		const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
		return { r: +m[1], g: +m[2], b: +m[3], a };
	}
	throw new Error('не разобран цвет: ' + value);
}

const over = (top, base) => ({ r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1 });
const lin = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
export const ratio = (fg, bg) => { const [hi, lo] = [lum(fg), lum(bg)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };

// color-mix(in oklab, <tint> p%, <base>) для палитры графиков (rt-ui charts.css: --rt-chart-tint 12 %)
const toOklab = (c) => {
	const [r, g, b] = [c.r, c.g, c.b].map(lin);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const fromOklab = ([L, a, b]) => {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
	const enc = (x) => Math.min(255, Math.max(0, 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055)));
	return { r: enc(rgb[0]), g: enc(rgb[1]), b: enc(rgb[2]), a: 1 };
};
const mix = (tint, pct, base) => { const A = toOklab(base), B = toOklab(tint); return fromOklab(A.map((x, i) => x * (1 - pct) + B[i] * pct)); };
const CHART = { 1: ['accent-500', 1], 2: ['status-01-400', 1], 3: ['status-04-500', 0], 4: ['info-500', 1], 5: ['success-500', 1], 6: ['status-05-500', 1], 7: ['warning-600', 1], 8: ['status-03-500', 1], 9: ['status-06-500', 1], 10: ['status-02-400', 1] };

/**
 * Каталог пар. kind: 'text' (AA 4,5 / AAA 7) или 'ui' (WCAG 1.4.11: 3).
 * req=false — справочные строки (декор, disabled, кандидаты): в таблице есть, проверку не роняют.
 * Выражение цвета: `токен` (без --atmr-), `a>b` = a поверх b, `chart-N` = палитра графиков.
 */
export function catalogue() {
	const P = [];
	const add = (group, name, fg, bg, kind = 'text', req = true) => P.push({ group, name, fg, bg, kind, req });
	const G = { t: 'Текст на фонах', c: 'Цветной текст и ссылки', b: 'Кнопки', s: 'Чипы статусов (Badge secondary)', n: 'Плашки (Notice)', u: 'Границы и фокус (WCAG 1.4.11, 3:1)', g: 'Графики (метки 3:1, rt-ui charts.css)' };
	const surfaces = ['bg-page', 'bg-surface1', 'bg-surface2', 'bg-surface3', 'bg-surface4', 'bg-surface5'];
	// bg-surface4/5 (#e8e8ee, #d3d4db) под текстом в приложении не встречаются (bg-surface-4: 0 использований), поэтому для soft и muted они справочные
	for (const fg of ['fg-default', 'fg-soft', 'fg-muted']) for (const bg of surfaces) add(G.t, `${fg} на ${bg}`, fg, bg, 'text', fg === 'fg-default' || !/surface[45]$/.test(bg));
	for (const bg of surfaces) add(G.t, `fg-disabled на ${bg} (исключение WCAG для неактивных)`, 'fg-disabled', bg, 'text', false);
	for (const s of ['accent', 'error', 'success', 'warning', 'info', 'neutral']) for (const bg of ['bg-surface1', 'bg-surface3']) add(G.c, `${s}-default на ${bg}`, `${s}-default`, bg, 'text', !(s === 'warning' || (s === 'info' && bg === 'bg-surface3')));
	add(G.c, 'accent-hover (ссылка при наведении) на surface1', 'accent-hover', 'bg-surface1');
	add(G.c, 'text-warning приложения (--app-warning-text) на surface1', 'app-warning-text', 'bg-surface1');
	add(G.c, 'text-warning приложения (--app-warning-text) на surface3', 'app-warning-text', 'bg-surface3');
	for (const c of ['accent-700', 'error-700', 'success-700', 'warning-800']) add(G.c, `${c} на surface1 (кандидат)`, c, 'bg-surface1', 'text', false);
	add(G.b, 'primary accent: подпись на accent-default', 'accent-on-accent', 'accent-default');
	add(G.b, 'primary accent, наведение', 'accent-on-accent', 'accent-hover');
	add(G.b, 'primary neutral', 'neutral-on-neutral', 'neutral-default');
	add(G.b, 'danger primary', 'error-on-error', 'error-default');
	add(G.b, 'primary accent, disabled (исключение WCAG)', 'neutral-on-neutral', 'neutral-container-active>bg-surface1', 'text', false);
	add(G.b, 'secondary accent', 'accent-on-container', 'accent-container-default>bg-surface1');
	add(G.b, 'secondary neutral', 'neutral-on-container', 'neutral-container-default>bg-surface1');
	add(G.b, 'outline и ghost neutral (подпись)', 'neutral-default', 'bg-surface1');
	add(G.b, 'ghost и outline accent (подпись)', 'accent-default', 'bg-surface1');
	for (const s of ['info', 'success', 'warning', 'error', 'neutral', 'accent', 'status-01', 'status-02', 'status-03', 'status-04', 'status-05', 'status-06']) add(G.s, `${s}: подпись на container-default`, `${s}-on-container`, `${s}-container-default>bg-surface1`);
	add(G.s, 'neutral на строке таблицы под курсором (surface3)', 'neutral-on-container', 'neutral-container-default>bg-surface3');
	for (const t of ['info', 'warning', 'error', 'success']) {
		add(G.n, `${t}: подзаголовок fg-soft`, 'fg-soft', `${t}-container-default>bg-surface1`);
		add(G.n, `${t}: значок ${t}-default (3:1)`, `${t}-default`, `${t}-container-default>bg-surface1`, 'ui', t !== 'warning');
	}
	add(G.u, 'граница поля в покое', 'input-primary-border-color-default>bg-surface1', 'bg-surface1', 'ui');
	add(G.u, 'граница поля при наведении', 'input-primary-border-color-hover>bg-surface1', 'bg-surface1', 'ui');
	add(G.u, 'граница поля в фокусе', 'input-primary-border-color-focus', 'bg-surface1', 'ui');
	add(G.u, 'граница флажка и радиокнопки в покое', 'checkbox-primary-border-color-default>bg-surface1', 'bg-surface1', 'ui');
	add(G.u, 'трек выключенного переключателя', 'switch-primary-track-bg-color-default>bg-surface1', 'bg-surface1', 'ui');
	add(G.u, 'трек включённого переключателя', 'switch-primary-track-bg-color-checked-default', 'bg-surface1', 'ui');
	add(G.u, 'кольцо фокуса (accent-default, app.css:197) на surface1', 'accent-default', 'bg-surface1', 'ui');
	add(G.u, 'кольцо фокуса на surface3', 'accent-default', 'bg-surface3', 'ui');
	add(G.u, 'значки fg-muted на surface1', 'fg-muted', 'bg-surface1', 'ui');
	add(G.u, 'разделитель border-soft (декор)', 'border-soft>bg-surface1', 'bg-surface1', 'ui', false);
	add(G.u, 'разделитель border-default на surface3 (декор)', 'border-default>bg-surface3', 'bg-surface3', 'ui', false);
	for (let i = 1; i <= 10; i++) add(G.g, `--rt-chart-${i} на surface1`, `chart-${i}`, 'bg-surface1', 'ui');
	add(G.g, 'chart-other (neutral-400)', 'neutral-400', 'bg-surface1', 'ui');
	add(G.g, 'подписи осей (fg-soft)', 'fg-soft', 'bg-surface1');
	add(G.g, 'линии сетки (декор)', 'border-muted>bg-surface1', 'bg-surface1', 'ui', false);
	return P;
}

function resolver(tokens) {
	const tok = (n) => parse(n.startsWith('app-') ? `var(--${n})` : `var(--atmr-${n})`, tokens);
	return (expr, baseSurface) => {
		if (expr.startsWith('chart-')) { const [t, tinted] = CHART[+expr.slice(6)]; return tinted ? mix(tok('fg-default'), 0.12, tok(t)) : tok(t); }
		if (expr.includes('>')) { const [top, base] = expr.split('>'); return over(tok(top), over(tok(base), tok('bg-surface1'))); }
		return over(tok(expr), baseSurface ?? tok('bg-surface1'));
	};
}

/** -> [{ group, name, kind, req, themes: { <тема>: { ratio } } }]. overlays = { <тема>: css } (см. overlaysFromCss). */
export function evaluate(themesDir, overlays = {}) {
	const catalog = catalogue();
	const per = {};
	for (const theme of THEMES) {
		const tokens = loadTokens(readFileSync(join(themesDir, theme + '.css'), 'utf8'), overlays[theme] ?? '');
		const res = resolver(tokens);
		per[theme] = catalog.map((p) => {
			const bg = res(p.bg);
			const fg = p.fg.includes('>') ? res(p.fg) : res(p.fg, bg);
			return ratio(fg, bg);
		});
	}
	return catalog.map((p, i) => ({ ...p, themes: Object.fromEntries(THEMES.map((t) => [t, { ratio: per[t][i] }])) }));
}

export const need = (p) => (p.kind === 'ui' ? 3 : 4.5);
export const verdict = (p, r) => (p.kind === 'ui' ? (r >= 3 ? 'ок' : 'нет') : r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'крупн.' : 'нет');
/** обязательные пары, не достигшие порога: [{ theme, name, ratio, need }] */
export const failures = (rows) => rows.flatMap((p) => THEMES.filter((t) => p.req && p.themes[t].ratio < need(p)).map((t) => ({ theme: t, name: p.name, ratio: p.themes[t].ratio, need: need(p) })));

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
	const dir = arg('--themes') ?? defaultThemesDir();
	const overlayFile = arg('--overlay');
	const overlays = overlayFile && existsSync(overlayFile) ? overlaysFromCss(readFileSync(overlayFile, 'utf8')) : {};
	const rows = evaluate(dir, overlays);
	if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
	else if (process.argv.includes('--md')) {
		let group = '';
		for (const p of rows) {
			if (p.group !== group) { group = p.group; console.log(`\n**${group}**\n\n| Пара | ${THEMES.join(' | ')} |\n|---|---|---|---|---|`); }
			console.log(`| ${p.name} | ${THEMES.map((t) => `${p.themes[t].ratio.toFixed(2).replace('.', ',')} ${verdict(p, p.themes[t].ratio)}`).join(' | ')} |`);
		}
	} else for (const p of rows) console.log(p.name.padEnd(64), THEMES.map((t) => p.themes[t].ratio.toFixed(2).padStart(6) + ' ' + verdict(p, p.themes[t].ratio).padEnd(6)).join(' '));
	const bad = failures(rows);
	if (bad.length) { console.error(`\nне проходят: ${bad.length}`); for (const f of bad) console.error(`  ${f.theme}: ${f.name} = ${f.ratio.toFixed(2)} (< ${f.need})`); }
	if (process.argv.includes('--check') && bad.length) process.exit(1);
}
