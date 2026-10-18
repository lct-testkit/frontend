// Чистая геометрия подписей при выгрузке диаграммы (без DOM, проверяется vitest): положение подписи на сегменте кольца, читаемый цвет текста, текст пункта легенды.

const TAU = Math.PI * 2;

/** Грубая ширина строки по числу знаков (цифры и короткие слова): хватает, чтобы оставить поле у края картинки. */
export const textWidth = (text: string, fontSize: number): number => text.length * fontSize * 0.6;

export interface Ring {
	/** внутренний и внешний радиус сегмента */
	r0: number;
	r1: number;
	/** угол середины сегмента: 0 — вверху, по часовой стрелке (как в rt-ui `polar`) */
	mid: number;
	/** угловой размер сегмента */
	span: number;
}

const NUM = '(-?[\\d.]+)';
const SECTOR = new RegExp(`^M${NUM},${NUM}A${NUM},${NUM} 0 [01] 1 ${NUM},${NUM}(?:L${NUM},${NUM}A${NUM},${NUM} 0 [01] 0 ${NUM},${NUM})?`);

/**
 * Разбор контура сегмента кольца, как его рисует rt-ui (`arcPath`): `M внешняя-начало A r1 … внешняя-конец L внутренняя-конец A r0 … внутренняя-начало Z`.
 * Одиночный сегмент — полное кольцо из двух половин (угол середины 0, размер 2π). Не кольцо (сектор круга, другой формат) — null.
 */
export function ringGeometry(d: string, cx: number, cy: number): Ring | null {
	const m = SECTOR.exec(d.trim());
	if (!m) return null;
	const [, x0, y0, r1, , x1, y1, , , r0] = m.map((v, i) => (i === 0 ? Number.NaN : Number(v)));
	const angle = (x: number, y: number) => (Math.atan2(x - cx, -(y - cy)) + TAU) % TAU;
	if (Number.isNaN(r0)) {
		// полное кольцо: внутренний радиус — из второго контура `M…A r0`
		const inner = /Z\s*M-?[\d.]+,-?[\d.]+A(-?[\d.]+),/.exec(d);
		return { r0: inner ? Number(inner[1]) : 0, r1, mid: 0, span: TAU };
	}
	const start = angle(x0, y0);
	const span = (angle(x1, y1) - start + TAU) % TAU;
	return { r0, r1, mid: (start + span / 2) % TAU, span };
}

/** Тёмный или белый текст — что контрастнее на заливке `rgb(r, g, b)`. */
export function readableOn(rgb: string, dark = '#111111', light = '#ffffff'): string {
	const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(rgb);
	if (!m) return light;
	const lin = (v: number) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * lin(Number(m[1])) + 0.7152 * lin(Number(m[2])) + 0.0722 * lin(Number(m[3]));
	// белый (контраст не ниже 3.9) выбирается, пока яркость заливки не выше 0.22
	return luminance > 0.22 ? dark : light;
}

/** Пункт легенды в файле: «Не устроила цена — 1 (50 %)»; у столбцов и линий значений нет — просто название. */
export function legendText(label: string, value: string, secondary: string): string {
	return `${label}${value ? ` — ${value}` : ''}${secondary ? ` (${secondary})` : ''}`;
}

/** Вершины ломаной или сглаженной линии rt-ui (`M x,y`, `L x,y`, `C c1 c2 x,y`): конечная точка каждой команды. */
export function pathVertices(d: string): [number, number][] {
	const out: [number, number][] = [];
	for (const m of d.matchAll(/([MLC])([^MLC]*)/g)) {
		const nums = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
		if (nums.length >= 2 && nums.every(Number.isFinite)) out.push([nums[nums.length - 2], nums[nums.length - 1]]);
	}
	return out;
}

export interface PointLabel {
	x: number;
	y: number;
	value: number;
	text: string;
}

/**
 * Какие подписи точек линий оставить: нули не подписываются (ось есть), а подписи, которые слиплись (ближе `gap` по вертикали при пересечении по горизонтали),
 * разрешаются в пользу большего значения.
 */
export function pickPointLabels(points: PointLabel[], gap: number, width: (text: string) => number): PointLabel[] {
	const kept: PointLabel[] = [];
	for (const p of [...points].filter((q) => q.value !== 0).sort((a, b) => b.value - a.value)) {
		const clash = kept.some((k) => Math.abs(k.y - p.y) < gap && Math.abs(k.x - p.x) < (width(k.text) + width(p.text)) / 2 + 2);
		if (!clash) kept.push(p);
	}
	return kept;
}
