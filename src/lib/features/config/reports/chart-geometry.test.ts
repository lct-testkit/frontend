import { describe, expect, it } from 'vitest';
import { legendText, readableOn, ringGeometry, textWidth } from './chart-geometry';

/** Контур сегмента так же, как его строит rt-ui (`arcPath`): внешняя дуга по часовой, отрезок к внутренней, внутренняя дуга обратно. */
const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;
const f = (n: number) => String(Math.round(n * 100) / 100);
function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
	const large = a1 - a0 > Math.PI ? 1 : 0;
	const [ox0, oy0] = polar(cx, cy, r1, a0);
	const [ox1, oy1] = polar(cx, cy, r1, a1);
	const [ix1, iy1] = polar(cx, cy, r0, a1);
	const [ix0, iy0] = polar(cx, cy, r0, a0);
	return `M${f(ox0)},${f(oy0)}A${f(r1)},${f(r1)} 0 ${large} 1 ${f(ox1)},${f(oy1)}L${f(ix1)},${f(iy1)}A${f(r0)},${f(r0)} 0 ${large} 0 ${f(ix0)},${f(iy0)}Z`;
}

describe('ringGeometry: сегмент кольца по контуру rt-ui', () => {
	it('половина кольца справа: середина — 90°, размер — π, радиусы из контура', () => {
		const ring = ringGeometry(sector(90, 90, 52, 83, 0.01, Math.PI - 0.01), 90, 90);
		expect(ring).not.toBeNull();
		expect(ring!.r0).toBeCloseTo(52, 1);
		expect(ring!.r1).toBeCloseTo(83, 1);
		expect(ring!.mid).toBeCloseTo(Math.PI / 2, 1);
		expect(ring!.span).toBeCloseTo(Math.PI - 0.02, 1);
	});

	it('сегмент, переходящий через верхнюю точку: середина считается по ходу часовой стрелки', () => {
		// от -0.3 рад до 0.5 рад: середина 0.1
		const ring = ringGeometry(sector(100, 100, 40, 80, -0.3, 0.5), 100, 100);
		expect(ring!.mid).toBeCloseTo(0.1, 1);
		expect(ring!.span).toBeCloseTo(0.8, 1);
	});

	it('большой сегмент (больше половины): угол середины внутри него', () => {
		// от 0.2 до 5.0 рад — середина 2.6 (нижняя часть кольца)
		const ring = ringGeometry(sector(100, 100, 40, 80, 0.2, 5.0), 100, 100);
		expect(ring!.mid).toBeCloseTo(2.6, 1);
		expect(ring!.span).toBeCloseTo(4.8, 1);
	});

	it('единственный сегмент — полное кольцо из двух половин', () => {
		const d = 'M90,7A83,83 0 1 1 90,173A83,83 0 1 1 90,7ZM90,38A52,52 0 1 0 90,142A52,52 0 1 0 90,38Z';
		const ring = ringGeometry(d, 90, 90);
		expect(ring).toEqual({ r0: 52, r1: 83, mid: 0, span: Math.PI * 2 });
	});

	it('чужой формат контура (сектор круга) и пустая строка — null', () => {
		expect(ringGeometry('M90,90L90,7A83,83 0 0 1 173,90Z', 90, 90)).toBeNull();
		expect(ringGeometry('', 90, 90)).toBeNull();
	});
});

describe('readableOn: цвет подписи на заливке', () => {
	it('на тёмной и насыщенной заливке — белый, на светлой — тёмный', () => {
		expect(readableOn('rgb(130, 52, 224)')).toBe('#ffffff');
		expect(readableOn('rgb(223, 76, 36)')).toBe('#ffffff');
		expect(readableOn('rgb(25, 155, 170)')).toBe('#111111');
		expect(readableOn('rgb(255, 255, 255)')).toBe('#111111');
		expect(readableOn('rgba(0, 0, 0, 0.5)')).toBe('#ffffff');
	});

	it('нераспознанный цвет — белый', () => {
		expect(readableOn('var(--x)')).toBe('#ffffff');
	});
});

describe('legendText: пункт легенды в файле', () => {
	it('кольцо: название — значение (доля); столбцы и линии: только название', () => {
		expect(legendText('Не устроила цена', '1', '50 %')).toBe('Не устроила цена — 1 (50 %)');
		expect(legendText('В норме', '30', '')).toBe('В норме — 30');
		expect(legendText('Создано', '', '')).toBe('Создано');
	});
});

describe('textWidth', () => {
	it('растёт с длиной строки и кеглем', () => {
		expect(textWidth('10', 12)).toBeLessThan(textWidth('1000', 12));
		expect(textWidth('10', 12)).toBeLessThan(textWidth('10', 24));
	});
});
