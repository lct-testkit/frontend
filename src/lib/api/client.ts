import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { ApiError } from './errors';
import { getConfig } from '$lib/config';
import { getAccessToken, hasTokens, refreshTokens } from '$lib/auth/tokens';
import { emitAuthEvent } from '$lib/auth/events';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_COOKIE = 'crm_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

function csrfToken(): string | null {
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
	return match ? decodeURIComponent(match[1]) : null;
}

const pathOf = (request: Request) => new URL(request.url).pathname;
const isApi = (request: Request) => pathOf(request).startsWith('/api/');

/** request kept for one replay after a silent token refresh (bodies can only be read once) */
const replay = new WeakMap<Request, Request>();
const replayed = new WeakSet<Request>();

const middleware: Middleware = {
	async onRequest({ request }) {
		if (getConfig().mode === 'demo') {
			// public endpoints (/public/sign, /public/verify) are anonymous by design: never attach an identity to them
			if (isApi(request)) {
				const token = await getAccessToken();
				if (token) request.headers.set('Authorization', `Bearer ${token}`);
			}
		} else if (!SAFE.has(request.method.toUpperCase())) {
			const csrf = csrfToken();
			if (csrf) request.headers.set(CSRF_HEADER, csrf);
		}
		if (!request.headers.has('X-Request-Id')) request.headers.set('X-Request-Id', crypto.randomUUID());
		if (getConfig().mode === 'demo' && isApi(request)) replay.set(request, request.clone());
		return request;
	},

	async onResponse({ request, response }) {
		if (!isApi(request)) return undefined;

		if (response.status === 401 || response.status === 409 || response.status === 403) {
			const problem = (await response.clone().json().catch(() => null)) as { code?: string } | null;
			const code = problem?.code;

			// demo: expired / stale token → one silent refresh and replay
			if (getConfig().mode === 'demo' && (response.status === 401 || code === 'CRM-1103') && hasTokens()) {
				const copy = replay.get(request);
				if (copy && !replayed.has(copy)) {
					replayed.add(copy);
					const fresh = await refreshTokens();
					if (fresh) {
						copy.headers.set('Authorization', `Bearer ${fresh.access_token}`);
						return fetch(copy);
					}
				}
			}
			if (response.status === 401) emitAuthEvent({ type: 'unauthorized', status: 401 });
			else if (code === 'CRM-1105') emitAuthEvent({ type: 'consent_required' });
			else if (code === 'CRM-1106') emitAuthEvent({ type: 'password_change_required' });
			else if (code === 'CRM-1104') emitAuthEvent({ type: 'blocked' });
		}
		return undefined;
	},

	onError({ error }) {
		if (error instanceof DOMException && error.name === 'AbortError') return error;
		return ApiError.network(error);
	}
};

/**
 * Typed client over the backend OpenAPI (src/lib/api/schema.d.ts, `pnpm gen:api`). Same origin: paths already start with /api or /public.
 * Prefer `unwrap(api.GET(...))`, which throws ApiError instead of returning `{ error }`.
 */
export const api = createClient<paths>({ baseUrl: '' });
api.use(middleware);

type Settled = { data?: unknown; error?: unknown; response: Response };
type DataOf<T extends Settled> = [Exclude<T['data'], undefined>] extends [never] ? void : Exclude<T['data'], undefined>;

/** Returns `data` or throws ApiError (RFC 7807 parsed). 204 → undefined. */
export async function unwrap<T extends Settled>(promise: Promise<T>): Promise<DataOf<T>> {
	const result = await promise;
	if (result.error !== undefined || !result.response.ok) {
		throw ApiError.fromProblem(result.response.status, result.error, result.response.headers);
	}
	return result.data as DataOf<T>;
}

/** `Idempotency-Key`: create ONE key per logical submit (per form instance) so a retry after a network failure reuses it. */
export function idem(key: string = crypto.randomUUID()): { 'Idempotency-Key': string } {
	return { 'Idempotency-Key': key };
}

/** Optimistic locking header: `If-Match: "<version>"`. */
export function ifMatch(version: number | string): { 'If-Match': string } {
	return { 'If-Match': `"${version}"` };
}
