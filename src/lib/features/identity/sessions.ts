// «Мои сессии» (new_spec §4.3): читаемое описание User-Agent и порядок карточек.

export interface SessionLike {
	sid: string;
	device?: string | null;
	ip?: string | null;
	user_agent?: string | null;
	created_at: string;
	last_seen_at: string;
	is_current?: boolean;
}

const BROWSERS: [RegExp, string][] = [
	[/\bEdg(e|A|iOS)?\//i, 'Edge'],
	[/\bYaBrowser\//i, 'Яндекс Браузер'],
	[/\bOPR\/|Opera/i, 'Opera'],
	[/\bFirefox\/|FxiOS/i, 'Firefox'],
	[/Chrome\/|CriOS/i, 'Chrome'],
	[/\bSafari\//i, 'Safari']
];

const OS: [RegExp, string][] = [
	[/Windows/i, 'Windows'],
	[/Android/i, 'Android'],
	[/iPhone|iPad/i, 'iOS'],
	[/Mac OS X|Macintosh/i, 'macOS'],
	[/Linux/i, 'Linux']
];

/** «Chrome · Windows»; для API-клиентов — сам User-Agent, коротко. */
export function describeUserAgent(ua: string | null | undefined, device?: string | null): string {
	if (!ua) return device ?? 'Неизвестное устройство';
	const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
	const os = OS.find(([re]) => re.test(ua))?.[1] ?? device ?? undefined;
	if (!browser) return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
	return [browser, os].filter(Boolean).join(' · ');
}

/** Текущая сессия первой, остальные — по последней активности (новые сверху). */
export function sortSessions<T extends SessionLike>(items: readonly T[]): T[] {
	return [...items].sort((a, b) => {
		if (!!a.is_current !== !!b.is_current) return a.is_current ? -1 : 1;
		return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
	});
}
