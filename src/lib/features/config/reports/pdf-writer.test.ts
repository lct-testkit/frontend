import { describe, expect, it } from 'vitest';
import { A4, buildPdf, pageSizeFor, placeImage, type PdfPage } from './pdf-writer';

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);
const page = (pxWidth = 100, pxHeight = 50, kind: 'flate' | 'jpeg' = 'flate'): PdfPage => ({
	width: 100,
	height: 50,
	image: { kind, pxWidth, pxHeight, data: new Uint8Array([1, 2, 3, 4, 5, 6]) }
});

describe('PDF: сборка', () => {
	it('начинается с %PDF-1.4 и заканчивается %%EOF', () => {
		const s = text(buildPdf([page()]));
		expect(s.startsWith('%PDF-1.4')).toBe(true);
		expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
	});

	it('смещения таблицы xref указывают на строки «N 0 obj»', () => {
		const bytes = buildPdf([page(), page(200, 100)]);
		const s = text(bytes);
		const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
		expect(s.slice(xref, xref + 4)).toBe('xref');
		const entries = [...s.slice(xref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
		expect(entries.length).toBe(8); // каталог, список страниц и по три объекта на страницу
		entries.forEach((offset, i) => expect(s.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
	});

	it('/Length потока содержимого равен числу записанных байт; у картинки — длине данных', () => {
		const s = text(buildPdf([page()]));
		const content = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(s)!;
		expect(Number(content[1])).toBe(content[2].length);
		expect(s).toContain('/Length 6 >>');
	});

	it('у двух страниц /Count 2; фильтр — FlateDecode или DCTDecode', () => {
		const s = text(buildPdf([page(), page(100, 50, 'jpeg')]));
		expect(s).toContain('/Count 2');
		expect(s).toContain('/FlateDecode');
		expect(s).toContain('/DCTDecode');
	});

	it('без страниц — ошибка', () => {
		expect(() => buildPdf([])).toThrow();
	});
});

describe('PDF: раскладка', () => {
	it('картина шире, чем выше — альбомная A4; иначе книжная', () => {
		expect(pageSizeFor(1000, 500)).toEqual({ width: A4.h, height: A4.w });
		expect(pageSizeFor(500, 1000)).toEqual({ width: A4.w, height: A4.h });
	});

	it('картинка вписана в поля и сохраняет пропорции', () => {
		const { width, height } = pageSizeFor(1520, 800);
		const p = placeImage(1520, 800, width, height);
		expect(p.x).toBeGreaterThanOrEqual(0);
		expect(p.x + p.w).toBeLessThanOrEqual(width);
		expect(p.y).toBeGreaterThanOrEqual(0);
		expect(p.w / p.h).toBeCloseTo(1520 / 800, 5);
	});
});
