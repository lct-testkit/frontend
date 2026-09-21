// DEMO MODE ONLY. In demo the browser signs in as a seeded Keycloak user through the password grant and sends the
// access token as `Authorization: Bearer`. In prod the backend owns the session (httpOnly cookie) and none of this runs.
import { getConfig } from '$lib/config';

interface StoredTokens {
	access_token: string;
	refresh_token: string;
	/** epoch ms */
	access_expires_at: number;
	refresh_expires_at: number;
	username: string;
}

const KEY = 'rtk.demo.tokens';
const SKEW_MS = 20_000;

let memory: StoredTokens | null = null;
let refreshing: Promise<StoredTokens | null> | null = null;

function read(): StoredTokens | null {
	if (memory) return memory;
	try {
		const raw = localStorage.getItem(KEY);
		memory = raw ? (JSON.parse(raw) as StoredTokens) : null;
	} catch {
		memory = null;
	}
	return memory;
}

function write(tokens: StoredTokens | null): void {
	memory = tokens;
	try {
		if (tokens) localStorage.setItem(KEY, JSON.stringify(tokens));
		else localStorage.removeItem(KEY);
	} catch {
		// private mode: keep in memory only
	}
}

function endpoint(name: 'token' | 'logout'): string {
	const kc = getConfig().keycloak;
	return `${kc.path}/realms/${kc.realm}/protocol/openid-connect/${name}`;
}

async function grant(params: Record<string, string>, username: string): Promise<StoredTokens> {
	const kc = getConfig().keycloak;
	const body = new URLSearchParams({ client_id: kc.clientId, scope: 'openid', ...params });
	if (kc.clientSecret) body.set('client_secret', kc.clientSecret);
	const response = await fetch(endpoint('token'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!response.ok) {
		const problem = (await response.json().catch(() => ({}))) as { error?: string; error_description?: string };
		const err = new Error(problem.error === 'invalid_grant' ? 'Неверный логин или пароль' : problem.error_description || 'Не удалось войти');
		(err as Error & { status?: number }).status = response.status;
		throw err;
	}
	const json = (await response.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		refresh_expires_in?: number;
	};
	const now = Date.now();
	return {
		access_token: json.access_token,
		refresh_token: json.refresh_token,
		access_expires_at: now + json.expires_in * 1000,
		refresh_expires_at: now + (json.refresh_expires_in ?? 1800) * 1000,
		username
	};
}

export async function demoLogin(username: string, password: string): Promise<void> {
	write(await grant({ grant_type: 'password', username, password }, username));
}

export function hasTokens(): boolean {
	return read() !== null;
}

export function tokenUsername(): string | null {
	return read()?.username ?? null;
}

/** Refreshes single-flight; returns null when the refresh token is gone (→ caller signs out). */
export async function refreshTokens(): Promise<StoredTokens | null> {
	const current = read();
	if (!current) return null;
	refreshing ??= (async () => {
		try {
			const next = await grant({ grant_type: 'refresh_token', refresh_token: current.refresh_token }, current.username);
			write(next);
			return next;
		} catch {
			write(null);
			return null;
		} finally {
			refreshing = null;
		}
	})();
	return refreshing;
}

export async function getAccessToken(): Promise<string | null> {
	const current = read();
	if (!current) return null;
	if (current.access_expires_at - Date.now() > SKEW_MS) return current.access_token;
	return (await refreshTokens())?.access_token ?? null;
}

export async function demoLogout(): Promise<void> {
	const current = read();
	write(null);
	if (!current) return;
	try {
		const kc = getConfig().keycloak;
		const body = new URLSearchParams({ client_id: kc.clientId, refresh_token: current.refresh_token });
		if (kc.clientSecret) body.set('client_secret', kc.clientSecret);
		await fetch(endpoint('logout'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
	} catch {
		// the local sign-out already happened
	}
}
