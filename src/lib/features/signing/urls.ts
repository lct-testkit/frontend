// Ссылки ПЭП: бэкенд формирует `sign_url`/`verify_url` на JSON-ручки `/public/...`
// (backend-issues C-2/C-3), страницы SPA живут на `/sign/{token}` и `/verify/{id}`.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_RE.test(value.trim());

/** Токен из любой формы ссылки: `.../public/sign/<token>`, `.../sign/<token>?x`, либо сам токен. */
export function extractSignToken(urlOrToken: string): string | null {
	const raw = urlOrToken.trim();
	if (!raw) return null;
	const match = raw.match(/\/sign\/([A-Za-z0-9_-]+)/);
	if (match) return match[1];
	return /^[A-Za-z0-9_-]{16,}$/.test(raw) ? raw : null;
}

export const spaSignUrl = (origin: string, token: string): string => `${origin.replace(/\/$/, '')}/sign/${token}`;

export const spaVerifyUrl = (origin: string, signatureId: string): string =>
	`${origin.replace(/\/$/, '')}/verify/${signatureId}`;

/** Переписывает бэкендовский `sign_url` на страницу SPA; чужие/непонятные ссылки возвращает как есть. */
export function normalizeSignUrl(signUrl: string, origin: string): string {
	const token = extractSignToken(signUrl);
	return token ? spaSignUrl(origin, token) : signUrl;
}

export const isPresignedS3 = (url: string): boolean => /[?&]X-Amz-Signature=/i.test(url);

/**
 * Presigned-ссылка на PDF указывает на S3-хост (`localhost:8333`), у которого нет CORS, а CSP страницы
 * подписи разрешает только `self`. Если бакеты проксируются на текущий origin (Vite/Caddy), достаточно
 * заменить origin, сохранив путь и подпись (SigV4 подписывает путь, а не хост через прокси с changeOrigin).
 */
export function previewUrlForFetch(previewUrl: string, currentOrigin: string, s3Origins: readonly string[]): string {
	let parsed: URL;
	try {
		parsed = new URL(previewUrl);
	} catch {
		return previewUrl;
	}
	const same = parsed.origin === currentOrigin;
	if (same || !s3Origins.includes(parsed.origin)) return previewUrl;
	return `${currentOrigin}${parsed.pathname}${parsed.search}`;
}

/** «ab12cd34…ef56» — короткая форма хэша для карточек; полный — по копированию. */
export function shortHash(hash: string, head = 8, tail = 4): string {
	const h = hash.trim();
	if (h.length <= head + tail + 1) return h;
	return `${h.slice(0, head)}…${h.slice(-tail)}`;
}
