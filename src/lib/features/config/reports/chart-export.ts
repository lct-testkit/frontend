// Выгрузка диаграммы виджета в PNG и PDF на клиенте, без зависимостей: SVG графика rt-ui с встроенными стилями → картинка → canvas → PNG;
// PDF собирается из того же растра (pdf-writer.ts). Картинка совпадает с тем, что человек видел на экране, — это условие «объективности диаграмм».
// Цвета графика заданы CSS-переменными и `color-mix`, поэтому у «голого» SVG пропали бы заливки: стили копируются из вычисленных и переводятся в sRGB через canvas.
import { legendText, readableOn, ringGeometry, textWidth } from './chart-geometry';
import { buildPdf, pageSizeFor, type PdfImage } from './pdf-writer';
import { isoDate } from './period';

const FONT = '"Rostelecom Basis", system-ui, "Segoe UI", Arial, sans-serif';
const FONT_FILES: readonly [number, string][] = [
	[400, '/fonts/RostelecomBasis-Regular.woff'],
	[500, '/fonts/RostelecomBasis-Medium.woff'],
	[700, '/fonts/RostelecomBasis-Bold.woff']
];
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Свойства SVG-элементов, которые копируются из вычисленных стилей. */
const STYLE_PROPS = [
	'fill',
	'stroke',
	'stroke-width',
	'stroke-dasharray',
	'stroke-linecap',
	'stroke-linejoin',
	'opacity',
	'fill-opacity',
	'stroke-opacity',
	'font-size',
	'font-weight',
	'text-anchor',
	'dominant-baseline',
	'paint-order',
	'display',
	'visibility'
] as const;
const COLOR_PROPS: ReadonlySet<string> = new Set(['fill', 'stroke']);

export interface ExportCard {
	title: string;
	/** вторая строка: параметры отчёта («Период 01.09–30.09.2026 · Вузы: 2») */
	subtitle?: string;
	svg?: SVGSVGElement | null;
	legend?: HTMLElement | null;
	/** плитка-показатель вместо графика */
	tile?: { value: string; label: string };
	notes?: string[];
	footer: string;
	/** CSS-цвета фона и текста карточки на экране (в тёмной теме — тёмный фон) */
	background: string;
	foreground: string;
	scale?: number;
	/** ширина карточки в CSS-пикселях */
	width?: number;
}

// --- цвет ---------------------------------------------------------------------------------------------------

let colorContext: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, string>();

/** Любой CSS-цвет (в том числе `oklab()` из `color-mix`) → sRGB-строка `rgb()` / `rgba()`. `none` и `url(#…)` остаются как есть. */
export function toRgb(css: string): string {
	const value = css.trim();
	if (!value || value === 'none' || value === 'transparent' || value.startsWith('url(')) return value;
	const cached = colorCache.get(value);
	if (cached) return cached;
	colorContext ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	const ctx = colorContext;
	if (!ctx) return value;
	ctx.clearRect(0, 0, 1, 1);
	ctx.fillStyle = '#000';
	ctx.fillStyle = value;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
	const out = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
	colorCache.set(value, out);
	return out;
}

/** Тот же цвет с другой прозрачностью (для приглушённого текста). */
export function withAlpha(rgb: string, alpha: number): string {
	const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
	return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : rgb;
}

// --- SVG ---------------------------------------------------------------------------------------------------

let fontCss: Promise<string> | null = null;

/** @font-face шрифта интерфейса (Rostelecom Basis) со встроенными данными: картинка с SVG не видит шрифтов страницы. Нет шрифта — пустая строка, останется запасной. */
export function fontFaceCss(): Promise<string> {
	fontCss ??= (async () => {
		try {
			const faces = await Promise.all(
				FONT_FILES.map(async ([weight, url]) => {
					const res = await fetch(url);
					if (!res.ok) throw new Error(url);
					const bytes = new Uint8Array(await res.arrayBuffer());
					let binary = '';
					for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
					return `@font-face{font-family:'Rostelecom Basis';font-weight:${weight};src:url(data:font/woff;base64,${btoa(binary)}) format('woff')}`;
				})
			);
			return faces.join('');
		} catch {
			return '';
		}
	})();
	return fontCss;
}

const NUMBER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

interface Tick {
	x: number;
	y: number;
	value: number;
}

/** Куда дотянулись добавленные подписи (в единицах SVG): по этому прямоугольнику расширяется поле картинки, чтобы ничего не обрезалось. */
interface Extent {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

const emptyExtent = (): Extent => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

function readTicks(svg: SVGSVGElement, axis: 'x' | 'y'): { numeric: Tick[]; names: Tick[] } {
	const all = [...svg.querySelectorAll<SVGTextElement>(`text.rt-chart__tick--${axis}`)].map((t) => {
		const text = (t.textContent ?? '').replace(/\s/g, '').replace(',', '.');
		return { x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')), value: text === '' ? Number.NaN : Number(text) };
	});
	return { numeric: all.filter((t) => Number.isFinite(t.value)), names: all.filter((t) => !Number.isFinite(t.value)) };
}

/** Сдвиг группы `<g transform="translate(a, b)">`: подписи считаются в её координатах, а поле картинки — в координатах всего SVG. */
function translateOf(g: Element): [number, number] {
	const m = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(g.getAttribute('transform') ?? '');
	return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/**
 * Подписи значений у столбцов: на графике только ось, а в файле нужны числа («объективность диаграммы»). Значение берётся из положения столбца по шкале оси
 * (линейная подгонка по двум числовым делениям), а у отсутствующего столбца (нулевое значение) явно пишется «0» — пустой шаг не должен выглядеть как пропуск данных.
 */
function addValueLabels(svg: SVGSVGElement, clone: SVGSVGElement, color: string): Extent {
	const extent = emptyExtent();
	const plot = clone.querySelector(':scope > g');
	const bars = [...svg.querySelectorAll<SVGGraphicsElement>('path.rt-chart__bar')];
	if (!plot || !bars.length) return extent;
	const yAxis = readTicks(svg, 'y');
	const xAxis = readTicks(svg, 'x');
	const horizontal = xAxis.numeric.length >= 2;
	const scale = horizontal ? xAxis.numeric : yAxis.numeric;
	if (scale.length < 2) return extent;
	// размер подписи — как у делений оси
	const tick = svg.querySelector<SVGTextElement>('text.rt-chart__tick--x, text.rt-chart__tick--y');
	const fs = Math.max(10, Math.min(16, parseFloat(tick ? getComputedStyle(tick).fontSize : '') || 11));
	const [dx, dy] = translateOf(plot);
	const pos = (t: Tick) => (horizontal ? t.x : t.y);
	const first = scale[0];
	const last = scale[scale.length - 1];
	const k = (last.value - first.value) / (pos(last) - pos(first));
	const valueAt = (p: number) => first.value + (p - pos(first)) * k;
	const whole = scale.every((t) => Number.isInteger(t.value));
	const fmt = (v: number) => NUMBER.format(whole ? Math.round(v) : Math.round(v * 10) / 10);
	const zeroAt = first.value === 0 ? pos(first) : pos(first) - first.value / k;
	const fill = (el: Element) => toRgb(getComputedStyle(el).fill);
	const label = (text: string, x: number, y: number, anchor: 'start' | 'middle') => {
		const t = document.createElementNS(SVG_NS, 'text');
		t.textContent = text;
		t.setAttribute('x', String(x));
		t.setAttribute('y', String(y));
		t.setAttribute('text-anchor', anchor);
		t.setAttribute('dominant-baseline', 'middle');
		t.setAttribute('style', `font-size:${fs}px;font-weight:500;fill:${color}`);
		plot.appendChild(t);
		const w = textWidth(text, fs);
		extent.minX = Math.min(extent.minX, dx + (anchor === 'start' ? x : x - w / 2));
		extent.maxX = Math.max(extent.maxX, dx + (anchor === 'start' ? x + w : x + w / 2));
		extent.minY = Math.min(extent.minY, dy + y - fs / 2);
		extent.maxY = Math.max(extent.maxY, dy + y + fs / 2);
	};
	const boxes = bars.map((b) => ({ box: b.getBBox(), color: fill(b) }));
	if (horizontal) {
		for (const { box } of boxes) label(fmt(valueAt(box.x + box.width)), box.x + box.width + 4, box.y + box.height / 2, 'start');
		// категории без столбца — явный ноль
		for (const name of yAxis.names) if (!boxes.some(({ box }) => Math.abs(box.y + box.height / 2 - name.y) < box.height)) label('0', zeroAt + 4, name.y, 'start');
		return extent;
	}
	for (const { box } of boxes) label(fmt(valueAt(box.y)), box.x + box.width / 2, box.y - fs / 2 - 3, 'middle');
	// сгруппированные столбцы: положение серии внутри группы известно по другим категориям, нулевой столбец помечается на своём месте
	const centers = xAxis.names.length ? xAxis.names.map((t) => t.x) : xAxis.numeric.map((t) => t.x);
	const offsets = new Map<string, number>();
	for (const { box, color: c } of boxes) {
		const cx = box.x + box.width / 2;
		const near = centers.reduce((a, b) => (Math.abs(b - cx) < Math.abs(a - cx) ? b : a), centers[0]);
		if (!offsets.has(c)) offsets.set(c, cx - near);
	}
	const width = boxes[0].box.width;
	for (const center of centers) {
		for (const [c, off] of offsets) {
			const cx = center + off;
			if (!boxes.some((b) => b.color === c && Math.abs(b.box.x + b.box.width / 2 - cx) < width / 2)) label('0', cx, zeroAt - fs / 2 - 3, 'middle');
		}
	}
	return extent;
}

/**
 * Кольцевая диаграмма: значение и доля на каждом сегменте и итог в центре — на экране это показывают легенда и HTML-блок посередине, которых в SVG нет.
 * Узкий сегмент (подпись не помещается в кольцо) подписывается снаружи.
 */
function addDonutLabels(svg: SVGSVGElement, clone: SVGSVGElement, legend: HTMLElement | null | undefined, color: string, pxPerUnit: number): Extent {
	const extent = emptyExtent();
	const slices = [...svg.querySelectorAll<SVGPathElement>('path.rt-chart__slice')];
	const box = svg.viewBox?.baseVal;
	if (!slices.length || !box || box.width <= 0) return extent;
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	// размеры задаются в пикселях готовой картинки, а рисуются в единицах SVG
	const unit = (px: number) => px / Math.max(0.2, pxPerUnit);
	const fs = unit(14);
	const parts = new Map<string, { value: string; share: string }>();
	legend?.querySelectorAll<HTMLElement>('.rt-chart__legend-item').forEach((item) => {
		const part = (cls: string) => item.querySelector(`.rt-chart__legend-${cls}`)?.textContent?.trim() ?? '';
		parts.set(item.getAttribute('data-key') ?? '', { value: part('value'), share: part('secondary') });
	});
	const add = (text: string, x: number, y: number, o: { size: number; weight: number; fill: string; anchor?: 'start' | 'middle' | 'end' }) => {
		const t = document.createElementNS(SVG_NS, 'text');
		t.textContent = text;
		t.setAttribute('x', String(x));
		t.setAttribute('y', String(y));
		t.setAttribute('text-anchor', o.anchor ?? 'middle');
		t.setAttribute('dominant-baseline', 'middle');
		t.setAttribute('style', `font-size:${o.size}px;font-weight:${o.weight};fill:${o.fill}`);
		clone.appendChild(t);
		const w = textWidth(text, o.size);
		const x0 = o.anchor === 'start' ? x : o.anchor === 'end' ? x - w : x - w / 2;
		extent.minX = Math.min(extent.minX, x0);
		extent.maxX = Math.max(extent.maxX, x0 + w);
		extent.minY = Math.min(extent.minY, y - o.size / 2);
		extent.maxY = Math.max(extent.maxY, y + o.size / 2);
	};
	let hole = 0;
	for (const path of slices) {
		const ring = ringGeometry(path.getAttribute('d') ?? '', cx, cy);
		const text = parts.get(path.getAttribute('data-series') ?? '');
		if (!ring || !text?.value) continue;
		hole = Math.max(hole, ring.r0);
		const rm = (ring.r0 + ring.r1) / 2;
		const at = (r: number) => [cx + r * Math.sin(ring.mid), cy - r * Math.cos(ring.mid)] as const;
		const fits = ring.span * rm >= textWidth(text.share || text.value, fs) + unit(8) && ring.r1 - ring.r0 >= fs * 2.4;
		if (fits) {
			const [x, y] = at(rm);
			const ink = readableOn(toRgb(getComputedStyle(path).fill));
			add(text.value, x, y - fs * 0.55, { size: fs, weight: 700, fill: ink });
			if (text.share) add(text.share, x, y + fs * 0.65, { size: fs * 0.85, weight: 500, fill: ink });
		} else {
			const [x, y] = at(ring.r1 + unit(12));
			const side = Math.sin(ring.mid);
			add(text.share ? `${text.value} · ${text.share}` : text.value, x, y, { size: fs, weight: 600, fill: color, anchor: side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle' });
		}
	}
	const total = svg.parentElement?.querySelector('.rt-chart__center-value')?.textContent?.trim();
	const caption = svg.parentElement?.querySelector('.rt-chart__center-label')?.textContent?.trim();
	if (total && hole > 0) {
		add(total, cx, cy - (caption ? unit(9) : 0), { size: unit(30), weight: 700, fill: color });
		if (caption) add(caption, cx, cy + unit(19), { size: unit(13), weight: 400, fill: withAlpha(color, 0.62) });
	}
	return extent;
}

/** Копия SVG с явными размерами и встроенными стилями: открывается как отдельная картинка и выглядит так же, как на экране. */
export function inlineSvg(
	svg: SVGSVGElement,
	opts: { css?: string; color?: string; legend?: HTMLElement | null; pxPerUnit?: number } = {}
): { markup: string; width: number; height: number } {
	const box = svg.viewBox?.baseVal;
	const rect = svg.getBoundingClientRect();
	let width = box && box.width > 0 ? box.width : rect.width;
	let height = box && box.height > 0 ? box.height : rect.height;
	const clone = svg.cloneNode(true) as SVGSVGElement;
	const from = [svg, ...svg.querySelectorAll('*')];
	const to = [clone, ...clone.querySelectorAll('*')];
	from.forEach((source, i) => {
		const target = to[i] as SVGElement | undefined;
		if (!target) return;
		const computed = getComputedStyle(source);
		for (const prop of STYLE_PROPS) {
			const raw = computed.getPropertyValue(prop);
			if (raw) target.style.setProperty(prop, COLOR_PROPS.has(prop) ? toRgb(raw) : raw);
		}
	});
	const color = opts.color ?? '#111';
	const bars = addValueLabels(svg, clone, color);
	const ring = addDonutLabels(svg, clone, opts.legend, color, opts.pxPerUnit ?? 1);
	if (box && box.width > 0) {
		// подпись не должна обрезаться краем картинки: поле расширяется ровно настолько, насколько она вылезла
		const lo = (a: number, b: number, own: number) => Math.min(own, Number.isFinite(a) ? Math.floor(a - 2) : own, Number.isFinite(b) ? Math.floor(b - 2) : own);
		const hi = (a: number, b: number, own: number) => Math.max(own, Number.isFinite(a) ? Math.ceil(a + 2) : own, Number.isFinite(b) ? Math.ceil(b + 2) : own);
		const x0 = lo(bars.minX, ring.minX, box.x);
		const y0 = lo(bars.minY, ring.minY, box.y);
		const x1 = hi(bars.maxX, ring.maxX, box.x + box.width);
		const y1 = hi(bars.maxY, ring.maxY, box.y + box.height);
		clone.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
		width = x1 - x0;
		height = y1 - y0;
	}
	if (opts.css) {
		const style = document.createElementNS(SVG_NS, 'style');
		style.textContent = opts.css;
		clone.insertBefore(style, clone.firstChild);
	}
	clone.setAttribute('xmlns', SVG_NS);
	clone.setAttribute('width', String(width));
	clone.setAttribute('height', String(height));
	clone.style.setProperty('font-family', FONT);
	return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Не удалось нарисовать диаграмму'));
		img.src = src;
	});
}

// --- карточка -----------------------------------------------------------------------------------------------

interface LegendItem {
	color: string;
	text: string;
}

/** Пункты легенды rt-ui; выключенные кликом по легенде (`aria-pressed="false"`) в файл не попадают. */
export function readLegend(legend: HTMLElement | null | undefined): LegendItem[] {
	if (!legend) return [];
	const items: LegendItem[] = [];
	legend.querySelectorAll<HTMLElement>('.rt-chart__legend-item').forEach((item) => {
		if (item.getAttribute('aria-pressed') === 'false') return;
		const swatch = item.querySelector<HTMLElement>('.rt-chart__swatch');
		const part = (cls: string) => item.querySelector(`.rt-chart__legend-${cls}`)?.textContent?.trim() ?? '';
		const text = legendText(part('label'), part('value'), part('secondary'));
		if (text) items.push({ color: swatch ? toRgb(getComputedStyle(swatch).backgroundColor) : '#888', text });
	});
	return items;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let line = '';
		for (const word of paragraph.split(/\s+/).filter(Boolean)) {
			const next = line ? `${line} ${word}` : word;
			if (line && ctx.measureText(next).width > maxWidth) {
				lines.push(line);
				line = word;
			} else line = next;
		}
		lines.push(line);
	}
	return lines;
}

/** Строка мелкого текста (примечания, подвал) и высота крупного числа плитки. */
const SMALL_LINE = 17;
const TILE_VALUE_H = 76;

/** Рисует карточку виджета (название, параметры, график с легендой или число, примечания, подвал) на canvas. */
export async function renderCard(card: ExportCard): Promise<HTMLCanvasElement> {
	const scale = card.scale ?? 2;
	const W = card.width ?? 760;
	const pad = 24;
	const inner = W - pad * 2;
	const fg = toRgb(card.foreground);
	const bg = toRgb(card.background);
	const muted = withAlpha(fg, 0.62);

	const css = card.svg ? await fontFaceCss() : '';
	if (css) await Promise.all(FONT_FILES.map(([w]) => document.fonts?.load(`${w} 16px "Rostelecom Basis"`).catch(() => [])));
	// вытянутый график занимает всю ширину; почти квадратный (кольцо) не растягивается на всю карточку, а стоит по центру
	const MAX_IMAGE_H = 460;
	// во сколько раз единица SVG станет крупнее в готовой картинке: от этого зависит размер подписей, которые мы дорисовываем сами
	const box = card.svg?.viewBox?.baseVal;
	const srcW = box && box.width > 0 ? box.width : (card.svg?.getBoundingClientRect().width ?? 1);
	const srcH = box && box.height > 0 ? box.height : (card.svg?.getBoundingClientRect().height ?? 1);
	const pxPerUnit = Math.min(inner / srcW, MAX_IMAGE_H / srcH);
	const svg = card.svg ? inlineSvg(card.svg, { css, color: fg, legend: card.legend, pxPerUnit }) : null;
	const image = svg ? await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.markup)}`) : null;
	const fullH = svg ? Math.round((inner * svg.height) / svg.width) : 0;
	const imageH = Math.min(fullH, MAX_IMAGE_H);
	const imageW = svg ? Math.round((imageH * svg.width) / svg.height) : 0;
	const legend = readLegend(card.legend);

	// измерение: на пустом canvas с теми же шрифтами
	const probe = document.createElement('canvas').getContext('2d')!;
	const font = (px: number, weight = 400) => `${weight} ${px}px ${FONT}`;
	probe.font = font(22, 700);
	const titleLines = wrap(probe, card.title, inner);
	probe.font = font(13);
	const subtitleLines = card.subtitle ? wrap(probe, card.subtitle, inner) : [];
	// примечания и подвал — одним мелким серым кеглем, строки переносятся по ширине графика (у плитки — по ширине карточки)
	probe.font = font(12);
	const textW = svg ? Math.min(inner, Math.max(imageW, 420)) : inner;
	const noteLines = (card.notes ?? []).flatMap((n) => wrap(probe, n, textW));
	const footerLines = wrap(probe, card.footer, textW);

	// легенда: пункты в ряд с переносом
	probe.font = font(13);
	const rows: LegendItem[][] = [];
	let row: LegendItem[] = [];
	let rowW = 0;
	for (const item of legend) {
		const w = 16 + probe.measureText(item.text).width + 20;
		if (row.length && rowW + w > inner) {
			rows.push(row);
			row = [];
			rowW = 0;
		}
		row.push(item);
		rowW += w;
	}
	if (row.length) rows.push(row);

	let H = pad + titleLines.length * 28;
	if (subtitleLines.length) H += 4 + subtitleLines.length * 18;
	H += 16;
	if (card.tile) H += TILE_VALUE_H + 28;
	if (image) H += imageH + 12;
	if (rows.length) H += rows.length * 22 + 8;
	if (noteLines.length) H += noteLines.length * SMALL_LINE + 6;
	H += footerLines.length * SMALL_LINE + pad;

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(W * scale);
	canvas.height = Math.round(H * scale);
	const ctx = canvas.getContext('2d')!;
	ctx.scale(scale, scale);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, W, H);
	ctx.textBaseline = 'top';

	let y = pad;
	ctx.fillStyle = fg;
	ctx.font = font(22, 700);
	for (const line of titleLines) {
		ctx.fillText(line, pad, y);
		y += 28;
	}
	if (subtitleLines.length) {
		y += 4;
		ctx.fillStyle = muted;
		ctx.font = font(13);
		for (const line of subtitleLines) {
			ctx.fillText(line, pad, y);
			y += 18;
		}
	}
	y += 16;

	if (card.tile) {
		ctx.fillStyle = fg;
		ctx.font = font(64, 700);
		ctx.fillText(card.tile.value, pad, y);
		y += TILE_VALUE_H;
		ctx.fillStyle = muted;
		ctx.font = font(16);
		ctx.fillText(card.tile.label, pad, y);
		y += 28;
	}
	if (image) {
		ctx.drawImage(image, pad + (inner - imageW) / 2, y, imageW, imageH);
		y += imageH + 12;
	}
	if (rows.length) {
		ctx.font = font(13);
		for (const r of rows) {
			let x = pad;
			for (const item of r) {
				ctx.fillStyle = item.color;
				ctx.fillRect(x, y + 3, 12, 12);
				ctx.fillStyle = fg;
				ctx.fillText(item.text, x + 18, y + 1);
				x += 16 + ctx.measureText(item.text).width + 20;
			}
			y += 22;
		}
		y += 8;
	}
	ctx.fillStyle = muted;
	ctx.font = font(12);
	for (const line of noteLines) {
		ctx.fillText(line, pad, y);
		y += SMALL_LINE;
	}
	if (noteLines.length) y += 6;
	for (const line of footerLines) {
		ctx.fillText(line, pad, y);
		y += SMALL_LINE;
	}
	return canvas;
}

// --- файлы --------------------------------------------------------------------------------------------------

export const toPng = (canvas: HTMLCanvasElement): Promise<Blob> =>
	new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось сохранить картинку'))), 'image/png'));

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Страница PDF из canvas: RGB со сжатием zlib; если `CompressionStream` нет (Safari до 16.4) — JPEG. */
async function pdfImage(canvas: HTMLCanvasElement): Promise<PdfImage> {
	const { width, height } = canvas;
	if (typeof CompressionStream === 'undefined') {
		const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
		if (!jpeg) throw new Error('Не удалось сохранить PDF');
		return { kind: 'jpeg', pxWidth: width, pxHeight: height, data: new Uint8Array(await jpeg.arrayBuffer()) };
	}
	const rgba = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
	const rgb = new Uint8Array(width * height * 3);
	for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
		rgb[j] = rgba[i];
		rgb[j + 1] = rgba[i + 1];
		rgb[j + 2] = rgba[i + 2];
	}
	return { kind: 'flate', pxWidth: width, pxHeight: height, data: await deflate(rgb) };
}

/** Один или несколько canvas — страницы PDF (A4, альбомная для широких картинок). */
export async function toPdf(canvas: HTMLCanvasElement | readonly HTMLCanvasElement[]): Promise<Blob> {
	const canvases = Array.isArray(canvas) ? canvas : [canvas as HTMLCanvasElement];
	const pages = [];
	for (const c of canvases) {
		const image = await pdfImage(c);
		pages.push({ ...pageSizeFor(image.pxWidth, image.pxHeight), image });
	}
	return new Blob([buildPdf(pages) as BlobPart], { type: 'application/pdf' });
}

// --- имена и подписи ---------------------------------------------------------------------------------------

/** `Воронка_по_статусам_2026-10-16.png`: запрещённые в именах файлов символы и пробелы заменяются на «_». */
export function exportFileName(title: string, at: Date, ext: 'png' | 'pdf' | 'json'): string {
	const safe = title
		.replace(/[\\/:*?"<>|]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return `${safe || 'Отчёт'}_${isoDate(at)}.${ext}`;
}

const dmy = (iso: string): string => iso.split('-').reverse().join('.');

/** «Период 01.09–30.09.2026 · Вузы: 2 · Направления: все»; без параметров — «Все данные». */
export function paramsSummary(params: Record<string, unknown>, labels: Record<string, string>): string {
	const from = typeof params.date_from === 'string' ? params.date_from : '';
	const to = typeof params.date_to === 'string' ? params.date_to : '';
	const count = (v: unknown): number => (Array.isArray(v) ? v.length : typeof v === 'string' && v ? v.split(',').filter(Boolean).length : 0);
	const keys = Object.keys(labels);
	if (!from && !to && !keys.some((k) => count(params[k]) > 0)) return 'Все данные';
	let period = 'Весь период';
	if (from && to) period = from.slice(0, 4) === to.slice(0, 4) ? `Период ${dmy(from).slice(0, 5)}–${dmy(to)}` : `Период ${dmy(from)}–${dmy(to)}`;
	else if (from) period = `Период с ${dmy(from)}`;
	else if (to) period = `Период по ${dmy(to)}`;
	return [period, ...keys.map((k) => `${labels[k]}: ${count(params[k]) || 'все'}`)].join(' · ');
}

/** Скачивание блоба без перехода со страницы. */
export function saveBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
