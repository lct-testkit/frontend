// Состояние страницы приглашения (/invite/[token]): проверка ссылки → ввод пароля → «Пароль задан».
// Пароль живёт только в полях формы и в теле одного запроса: не логируется и не сохраняется (ни в консоль, ни в localStorage).
import { ApiError, api, unwrap, type components } from '$lib/api';
import { invitePasswordServerError, passwordChecks, passwordValid } from './password';

type Invite = components['schemas']['InviteCheckResponse'];

/** loading → (invalid | failed | ready) ; ready → submitting → (done | ready с ошибкой | invalid) */
export type InvitePhase = 'loading' | 'invalid' | 'failed' | 'ready' | 'submitting' | 'done';

export interface InviteAdapter {
	check(token: string): Promise<Invite>;
	setPassword(token: string, password: string, repeat: string): Promise<{ login_url: string }>;
}

const inviteApi: InviteAdapter = {
	check: (token) => unwrap(api.GET('/api/auth/invite/{token}', { params: { path: { token } } })),
	setPassword: (token, password, repeat) =>
		unwrap(api.POST('/api/auth/invite/{token}/password', { params: { path: { token } }, body: { new_password: password, new_password_repeat: repeat } }))
};

export class InviteFlow {
	phase = $state<InvitePhase>('loading');
	invite = $state<Invite | null>(null);
	/** адрес входа из ответа на «задать пароль» (в демо вход — страница /login) */
	loginUrl = $state<string | null>(null);
	/** секунд до следующей попытки (429) */
	retryAfter = $state<number | null>(null);
	/** почему ссылка не открылась: 404 / 429 / сеть */
	loadError = $state<ApiError | null>(null);
	errors = $state<{ next?: string; repeat?: string; form?: string }>({});

	#api: InviteAdapter;
	#token = '';

	constructor(adapter: InviteAdapter = inviteApi) {
		this.#api = adapter;
	}

	async load(token: string): Promise<void> {
		this.#token = token;
		this.phase = 'loading';
		this.loadError = null;
		try {
			this.invite = await this.#api.check(token);
			this.phase = this.invite.valid ? 'ready' : 'invalid';
		} catch (e) {
			const err = e instanceof ApiError ? e : ApiError.network(e);
			this.loadError = err;
			this.retryAfter = err.retryAfter;
			this.phase = err.isNetwork || err.status >= 500 ? 'failed' : 'invalid';
		}
	}

	checks(password: string, repeat: string) {
		return passwordChecks({ current: '', next: password, repeat, skipCurrent: true, skipEmail: true, complexity: true });
	}

	canSubmit(password: string, repeat: string): boolean {
		return this.phase === 'ready' && passwordValid(this.checks(password, repeat));
	}

	/** `true` — пароль принят (фаза `done`); при ошибке причина раскладывается по полям, фаза остаётся `ready`. Повторная отправка при `submitting` игнорируется. */
	async submit(password: string, repeat: string): Promise<boolean> {
		if (!this.canSubmit(password, repeat)) return false;
		this.phase = 'submitting';
		this.errors = {};
		try {
			const out = await this.#api.setPassword(this.#token, password, repeat);
			this.loginUrl = out.login_url;
			this.phase = 'done';
			return true;
		} catch (e) {
			const err = e instanceof ApiError ? e : ApiError.network(e);
			this.phase = 'ready';
			if (err.status === 404) {
				// ссылка использована или истекла — сервер отвечает одинаково в обоих случаях
				this.loadError = err;
				this.phase = 'invalid';
			} else if (err.status === 429) {
				this.retryAfter = err.retryAfter;
				this.errors = { form: 'Слишком много попыток.' };
			} else if (err.isNetwork || err.status >= 500) {
				this.errors = { form: err.detail };
			} else {
				const info = invitePasswordServerError(err.detail, err.errors[0]?.reason);
				this.errors = info.field ? { [info.field]: info.message } : { form: info.message };
			}
			return false;
		}
	}

	clearErrors(): void {
		if (this.errors.next || this.errors.repeat || this.errors.form) this.errors = {};
	}
}
