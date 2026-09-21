// RFC 7807 Problem Details → ApiError. The backend never returns a stack trace, only `code` from the CRM-XXYY catalog.

export interface FieldIssue {
	field: string;
	reason: string;
	code?: string | null;
}

export interface ProblemBody {
	type?: string;
	title?: string;
	status?: number;
	detail?: string;
	instance?: string;
	request_id?: string | null;
	code?: string;
	errors?: FieldIssue[];
	[extra: string]: unknown;
}

/** Human texts for codes where the backend detail is too technical or lacks the next step. */
const MESSAGES: Record<string, string> = {
	'CRM-1002': 'Данные изменил другой пользователь. Обновите страницу и повторите.',
	'CRM-1101': 'Сессия истекла. Войдите снова.',
	'CRM-1102': 'Недостаточно прав для этого действия.',
	'CRM-1104': 'Учётная запись заблокирована. Обратитесь к администратору.',
	'CRM-1105': 'Сначала примите политику обработки персональных данных.',
	'CRM-1106': 'Сначала смените пароль.',
	'CRM-1107': 'Сессия устарела. Обновите страницу.',
	'CRM-8429': 'Слишком много запросов. Подождите немного.',
	'CRM-9000': 'Внутренняя ошибка сервера. Попробуйте позже.',
	'CRM-9503': 'Сервис временно недоступен. Попробуйте позже.'
};

export class ApiError extends Error {
	readonly status: number;
	readonly code: string | null;
	readonly title: string;
	readonly detail: string;
	readonly requestId: string | null;
	readonly errors: FieldIssue[];
	readonly extra: Record<string, unknown>;
	/** seconds from the `Retry-After` header (429 / rate limits), null when absent */
	readonly retryAfter: number | null;

	constructor(init: {
		status: number;
		code?: string | null;
		title?: string;
		detail?: string;
		requestId?: string | null;
		errors?: FieldIssue[];
		extra?: Record<string, unknown>;
		retryAfter?: number | null;
	}) {
		const detail = init.detail || init.title || 'Ошибка запроса';
		super(detail);
		this.name = 'ApiError';
		this.status = init.status;
		this.code = init.code ?? null;
		this.title = init.title ?? detail;
		this.detail = detail;
		this.requestId = init.requestId ?? null;
		this.errors = init.errors ?? [];
		this.extra = init.extra ?? {};
		this.retryAfter = init.retryAfter ?? null;
	}

	static fromProblem(status: number, body: unknown, headers?: Headers): ApiError {
		const p = (body && typeof body === 'object' ? body : {}) as ProblemBody;
		const { type, title, status: _s, detail, instance, request_id, code, errors, ...extra } = p;
		void type;
		void _s;
		void instance;
		return new ApiError({
			status,
			code: code ?? null,
			title,
			detail: typeof detail === 'string' ? detail : undefined,
			requestId: request_id ?? headers?.get('x-request-id') ?? null,
			errors: Array.isArray(errors) ? errors : [],
			extra,
			retryAfter: (() => {
				const raw = headers?.get('retry-after');
				const n = raw ? Number(raw) : NaN;
				return Number.isFinite(n) ? n : null;
			})()
		});
	}

	static network(cause?: unknown): ApiError {
		const err = new ApiError({ status: 0, code: 'NETWORK', detail: 'Нет соединения с сервером. Проверьте сеть и повторите.' });
		if (cause) (err as { cause?: unknown }).cause = cause;
		return err;
	}

	get isNetwork() {
		return this.status === 0;
	}
	get isConflict() {
		return this.code === 'CRM-1002';
	}
	get isForbidden() {
		return this.status === 403;
	}
	get isNotFound() {
		return this.status === 404;
	}
	get isValidation() {
		return this.status === 422;
	}
	get isUnauthenticated() {
		return this.status === 401;
	}

	/** `{ email: 'reason', 'contact.phone': 'reason' }` — feed straight into form fields. */
	fieldErrors(): Record<string, string> {
		const out: Record<string, string> = {};
		for (const issue of this.errors) {
			if (!(issue.field in out)) out[issue.field] = issue.reason;
		}
		return out;
	}

	/** Error text for a specific field, tolerant to nested paths (`items.0.name` ↔ `name`). */
	fieldError(field: string): string | undefined {
		const all = this.fieldErrors();
		if (all[field]) return all[field];
		const hit = Object.keys(all).find((k) => k === field || k.endsWith(`.${field}`));
		return hit ? all[hit] : undefined;
	}
}

/** One user-facing sentence for any thrown value. */
export function errorMessage(e: unknown): string {
	if (e instanceof ApiError) {
		if (e.code && MESSAGES[e.code] && e.code !== 'CRM-1001') return MESSAGES[e.code];
		if (e.status === 422 && e.errors.length) {
			const first = e.errors[0];
			return first.field && first.field !== '__root__' ? `${first.field}: ${first.reason}` : first.reason;
		}
		return e.detail;
	}
	if (e instanceof DOMException && e.name === 'AbortError') return 'Запрос отменён.';
	if (e instanceof Error && e.message) return e.message;
	if (typeof e === 'string' && e) return e;
	return 'Что-то пошло не так. Попробуйте ещё раз.';
}
