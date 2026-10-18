// Минимальный писатель PDF для выгрузки диаграммы: страницы A4 с одной картинкой. Без зависимостей и без DOM — чистая функция над байтами.
// Текст уже нарисован в картинке (Helvetica без кириллицы и без встраивания шрифта в PDF не работает), поэтому в файле только изображения.

/** Картинка страницы: уже сжатые данные. `flate` — RGB, сжатый zlib (`CompressionStream('deflate')`); `jpeg` — готовый JPEG (запасной путь). */
export interface PdfImage {
	kind: 'flate' | 'jpeg';
	/** ширина и высота в пикселях */
	pxWidth: number;
	pxHeight: number;
	data: Uint8Array;
}

export interface PdfPage {
	/** размер страницы в пунктах (1/72 дюйма) */
	width: number;
	height: number;
	image: PdfImage;
}

/** A4 в пунктах. */
export const A4 = { w: 595.28, h: 841.89 } as const;
const MARGIN = 28;

/** Размер картинки на странице: вписана в поля, прижата к верху, по центру по ширине (в PDF ось Y идёт снизу вверх). */
export function placeImage(pxWidth: number, pxHeight: number, pageWidth: number, pageHeight: number): { x: number; y: number; w: number; h: number } {
	const k = Math.min((pageWidth - MARGIN * 2) / pxWidth, (pageHeight - MARGIN * 2) / pxHeight);
	const w = pxWidth * k;
	const h = pxHeight * k;
	return { x: (pageWidth - w) / 2, y: pageHeight - MARGIN - h, w, h };
}

/** Страница A4 под картинку: альбомная, если картинка шире, чем выше. */
export function pageSizeFor(pxWidth: number, pxHeight: number): { width: number; height: number } {
	return pxWidth > pxHeight ? { width: A4.h, height: A4.w } : { width: A4.w, height: A4.h };
}

const encoder = new TextEncoder();
const num = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Собирает PDF из страниц. Таблица xref содержит настоящие смещения объектов. */
export function buildPdf(pages: readonly PdfPage[]): Uint8Array {
	if (pages.length === 0) throw new Error('В PDF должна быть хотя бы одна страница');
	const chunks: Uint8Array[] = [];
	let offset = 0;
	const offsets: number[] = [];
	const push = (part: string | Uint8Array) => {
		const bytes = typeof part === 'string' ? encoder.encode(part) : part;
		chunks.push(bytes);
		offset += bytes.length;
	};
	const object = (id: number, body: string | Uint8Array[]) => {
		offsets[id] = offset;
		push(`${id} 0 obj\n`);
		if (typeof body === 'string') push(body);
		else for (const part of body) push(part);
		push('\nendobj\n');
	};

	push('%PDF-1.4\n%âãÏÓ\n');
	// объекты: 1 каталог, 2 список страниц, затем на каждую страницу — страница, поток содержимого, картинка
	const pageId = (i: number) => 3 + i * 3;
	object(1, '<< /Type /Catalog /Pages 2 0 R >>');
	object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] >>`);
	pages.forEach((page, i) => {
		const { image } = page;
		const { x, y, w, h } = placeImage(image.pxWidth, image.pxHeight, page.width, page.height);
		const id = pageId(i);
		object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] /Resources << /XObject << /Im${i} ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
		const content = `q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /Im${i} Do Q`;
		object(id + 1, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
		const filter = image.kind === 'jpeg' ? '/DCTDecode' : '/FlateDecode';
		const colorSpace = '/DeviceRGB';
		object(id + 2, [
			encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${image.pxWidth} /Height ${image.pxHeight} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter ${filter} /Length ${image.data.length} >>\nstream\n`),
			image.data,
			encoder.encode('\nendstream')
		]);
	});

	const count = 3 + pages.length * 3;
	const xref = offset;
	push(`xref\n0 ${count}\n0000000000 65535 f \n`);
	for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
	push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

	const out = new Uint8Array(offset);
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.length;
	}
	return out;
}
