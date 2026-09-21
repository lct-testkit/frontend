import { api, unwrap, ApiError, type components } from '$lib/api';
import { getConfig } from '$lib/config';
import { demoLogin, demoLogout, hasTokens } from './tokens';
import { onAuthEvent } from './events';

export type Me = components['schemas']['MeResponse'];
export type Role = 'KAM' | 'HEAD' | 'ADMIN' | 'AUDITOR' | 'INTEGRATION';

type Status = 'loading' | 'anonymous' | 'authenticated';

export const ROLE_LABEL: Record<string, string> = {
	KAM: 'Менеджер по вузам',
	HEAD: 'Руководитель',
	ADMIN: 'Администратор',
	AUDITOR: 'Аудитор',
	INTEGRATION: 'Интеграция'
};

/** Reactive singleton: who is signed in and what may they do. UI hides what the role cannot do; the backend is still the authority. */
class Session {
	status = $state<Status>('loading');
	me = $state<Me | null>(null);
	/** network / 5xx while loading the profile */
	error = $state<ApiError | null>(null);
	/** shown on the login page after a forced sign-out ("Сессия истекла") */
	notice = $state<string | null>(null);
	consentRequired = $state(false);
	passwordChangeRequired = $state(false);

	#scopes = $derived(new Set(this.me?.scopes ?? []));
	#started = false;

	get mode() {
		return getConfig().mode;
	}
	get role(): string | null {
		return this.me?.role ?? null;
	}
	get fullName(): string {
		return this.me?.full_name ?? '';
	}
	get roleLabel(): string {
		return this.role ? (ROLE_LABEL[this.role] ?? this.role) : '';
	}

	can(permission: string): boolean {
		return this.#scopes.has(permission);
	}
	canAny(...permissions: string[]): boolean {
		return permissions.some((p) => this.#scopes.has(p));
	}
	isRole(...roles: string[]): boolean {
		return this.role !== null && roles.includes(this.role);
	}

	start() {
		if (this.#started) return;
		this.#started = true;
		onAuthEvent((event) => {
			if (event.type === 'unauthorized' && this.status === 'authenticated') this.reset('Сессия истекла. Войдите снова.');
			else if (event.type === 'consent_required') this.consentRequired = true;
			else if (event.type === 'password_change_required') this.passwordChangeRequired = true;
			else if (event.type === 'blocked') this.reset('Учётная запись заблокирована. Обратитесь к администратору.');
		});
	}

	/** Load the profile; call once at startup and after every login. */
	async load(): Promise<void> {
		this.start();
		this.error = null;
		if (this.mode === 'demo' && !hasTokens()) {
			this.status = 'anonymous';
			this.me = null;
			return;
		}
		try {
			const me = await unwrap(api.GET('/api/me'));
			this.me = me;
			this.consentRequired = me.consent_required;
			this.passwordChangeRequired = me.password_change_required;
			this.status = 'authenticated';
		} catch (e) {
			if (e instanceof ApiError && e.isUnauthenticated) {
				this.status = 'anonymous';
				this.me = null;
			} else if (e instanceof ApiError && e.code === 'CRM-1104') {
				this.reset('Учётная запись заблокирована. Обратитесь к администратору.');
			} else {
				this.error = e instanceof ApiError ? e : ApiError.network(e);
				this.status = 'anonymous';
			}
		}
	}

	async loginDemo(username: string, password: string): Promise<void> {
		await demoLogin(username, password);
		this.notice = null;
		await this.load();
		if (this.status !== 'authenticated') throw this.error ?? new Error('Не удалось получить профиль');
	}

	/** prod: full-page redirect through Keycloak (state/nonce/PKCE are handled by the backend). */
	loginOidc(next = '/'): void {
		const target = new URL(next, location.origin).href;
		location.assign(`/api/auth/login?next=${encodeURIComponent(target)}`);
	}

	async logout(): Promise<void> {
		try {
			if (this.mode === 'demo') await demoLogout();
			else await api.POST('/api/auth/logout', { body: { local_only: false } });
		} catch {
			// the local state is cleared regardless
		}
		this.reset(null);
	}

	/** Drop the local identity (no network). */
	reset(notice: string | null) {
		this.me = null;
		this.status = 'anonymous';
		this.consentRequired = false;
		this.passwordChangeRequired = false;
		this.notice = notice;
	}

	async reload(): Promise<void> {
		const me = await unwrap(api.GET('/api/me'));
		this.me = me;
		this.consentRequired = me.consent_required;
		this.passwordChangeRequired = me.password_change_required;
	}
}

export const session = new Session();
