// Runtime config (static/config.json → served next to the bundle, swappable per deployment without a rebuild).
// Default is `prod`: if the file cannot be read the client never offers the demo account picker.

export type AppMode = 'demo' | 'prod';

export interface DemoAccount {
	username: string;
	password: string;
	role: string;
	name: string;
	position?: string;
}

export interface AppConfig {
	mode: AppMode;
	appName: string;
	keycloak: { path: string; realm: string; clientId: string; clientSecret?: string };
	demoAccounts: DemoAccount[];
}

const DEFAULT: AppConfig = {
	mode: 'prod',
	appName: 'RTK School',
	keycloak: { path: '/auth', realm: 'crm', clientId: 'crm-bff' },
	demoAccounts: []
};

let current: AppConfig = DEFAULT;

export function getConfig(): AppConfig {
	return current;
}

export async function loadConfig(fetchFn: typeof fetch = fetch): Promise<AppConfig> {
	try {
		const response = await fetchFn('/config.json', { cache: 'no-store' });
		if (response.ok) {
			const raw = (await response.json()) as Partial<AppConfig>;
			const mode: AppMode = raw.mode === 'demo' ? 'demo' : 'prod';
			current = {
				...DEFAULT,
				...raw,
				mode,
				keycloak: { ...DEFAULT.keycloak, ...raw.keycloak },
				// demo accounts (with passwords) are never kept in prod mode, whatever the file says
				demoAccounts: mode === 'demo' ? (raw.demoAccounts ?? []) : []
			};
		}
	} catch {
		// keep the safe default
	}
	return current;
}

export const isDemo = () => current.mode === 'demo';
