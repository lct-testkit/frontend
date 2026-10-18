// Откуда показывать PDF на странице подписи. Основной путь — `file_url`: тот же PDF с origin приложения (`/public/sign/{token}/file`
// или `/api/signature-requests/{id}/file`), без CORS и без ссылки на хранилище. Запасной (на один релиз, пока бэкенд без `file_url`) —
// `preview_url`: presigned-ссылка на хранилище, обычным `fetch`.
export interface PdfSourceDocument {
	file_url?: string | null;
	preview_url: string;
}

export type PdfSource = { kind: 'file_url' } | { kind: 'preview_url'; url: string };

export function pickPdfSource(document: PdfSourceDocument): PdfSource {
	return document.file_url?.trim() ? { kind: 'file_url' } : { kind: 'preview_url', url: document.preview_url };
}
