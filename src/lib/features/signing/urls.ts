// Ссылки ПЭП: бэкенд формирует `sign_url`/`verify_url` на JSON-ручки `/public/...`
// (backend-issues C-2/C-3: закрыто лидом, ссылки в PDF остаются на `/public/...`), страницы SPA живут на `/sign/{token}` и `/verify/{id}`.

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

const spaSignUrl = (origin: string, token: string): string => `${origin.replace(/\/$/, '')}/sign/${token}`;

export const spaVerifyUrl = (origin: string, signatureId: string): string =>
	`${origin.replace(/\/$/, '')}/verify/${signatureId}`;

/** Переписывает бэкендовский `sign_url` на страницу SPA; чужие/непонятные ссылки возвращает как есть. */
export function normalizeSignUrl(signUrl: string, origin: string): string {
	const token = extractSignToken(signUrl);
	return token ? spaSignUrl(origin, token) : signUrl;
}

/** «ab12cd34…ef56» — короткая форма хэша для карточек; полный — по копированию. */
export function shortHash(hash: string, head = 8, tail = 4): string {
	const h = hash.trim();
	if (h.length <= head + tail + 1) return h;
	return `${h.slice(0, head)}…${h.slice(-tail)}`;
}
