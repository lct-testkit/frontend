// Обёртка над pdfjs-dist v5: ленивый импорт (страницы без PDF не платят за библиотеку),
// воркер — локальный файл через Vite `?url` (без CDN, совместимо со строгим CSP `script-src 'self'`).
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { canvasSize } from './pdf-layout';

type PdfJs = typeof import('pdfjs-dist');

let libPromise: Promise<PdfJs> | null = null;

async function pdfjs(): Promise<PdfJs> {
	if (!libPromise) {
		libPromise = (async () => {
			const [mod, worker] = await Promise.all([
				import('pdfjs-dist'),
				import('pdfjs-dist/build/pdf.worker.min.mjs?url')
			]);
			mod.GlobalWorkerOptions.workerSrc = worker.default;
			return mod;
		})();
	}
	return libPromise;
}

/** Байты документа: без cookie (S3 их не ждёт) и с отменой при уходе со страницы. */
export async function fetchPdfBytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
	const response = await fetch(url, { signal, credentials: 'omit', cache: 'no-store' });
	if (!response.ok) throw new Error(`Не удалось загрузить документ (${response.status})`);
	return response.arrayBuffer();
}

export async function openPdf(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
	const lib = await pdfjs();
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	// Копия: pdf.js передаёт буфер воркеру и «отсоединяет» его, а исходник может ещё понадобиться (хэш).
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return lib.getDocument({ data: copy, disableAutoFetch: true }).promise;
}

export interface PageSize {
	widthPt: number;
	heightPt: number;
}

/** Размеры всех страниц при масштабе 1 — для раскладки до рендера. */
export async function pageSizes(pdf: PDFDocumentProxy): Promise<PageSize[]> {
	const sizes: PageSize[] = [];
	for (let n = 1; n <= pdf.numPages; n += 1) {
		const page = await pdf.getPage(n);
		const viewport = page.getViewport({ scale: 1 });
		sizes.push({ widthPt: viewport.width, heightPt: viewport.height });
	}
	return sizes;
}

/** Рисует страницу в canvas с учётом devicePixelRatio; возвращает функцию отмены незавершённого рендера. */
export function renderPage(page: PDFPageProxy, canvas: HTMLCanvasElement, scale: number, dpr: number): () => void {
	const viewport = page.getViewport({ scale });
	const size = canvasSize(viewport.width / scale, viewport.height / scale, scale, dpr);
	canvas.width = size.pixelWidth;
	canvas.height = size.pixelHeight;
	canvas.style.width = `${size.cssWidth}px`;
	canvas.style.height = `${size.cssHeight}px`;
	const context = canvas.getContext('2d');
	if (!context) return () => {};
	const task = page.render({
		canvas,
		canvasContext: context,
		viewport: page.getViewport({ scale: scale * size.ratio })
	});
	task.promise.catch(() => {
		// RenderingCancelledException при отмене — штатный случай.
	});
	return () => task.cancel();
}
