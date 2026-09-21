// One theme class on <body> (`Theme_root_<theme>`): portals (Modal, Drawer, Popover) live in <body> and inherit it.
export const THEMES = ['rtk_default_light', 'rtk_default_dark', 'rtk_purple_light', 'rtk_purple_dark'] as const;
export type Theme = (typeof THEMES)[number];

const KEY = 'rtk.theme';
const isTheme = (v: unknown): v is Theme => typeof v === 'string' && (THEMES as readonly string[]).includes(v);

function apply(theme: Theme) {
	const body = document.body;
	for (const cls of [...body.classList]) if (cls.startsWith('Theme_root_')) body.classList.remove(cls);
	body.classList.add(`Theme_root_${theme}`, 'rt-base');
	document.documentElement.style.colorScheme = theme.endsWith('_dark') ? 'dark' : 'light';
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.endsWith('_dark') ? '#16171b' : '#ffffff');
}

class ThemeStore {
	current = $state<Theme>('rtk_default_light');

	init() {
		// dev only: `?theme=rtk_default_dark` previews a theme without saving it (the block catalog's frames must not change the stored one)
		const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get('theme') : null;
		if (isTheme(forced)) {
			this.current = forced;
			apply(forced);
			return;
		}
		let stored: string | null = null;
		try {
			stored = localStorage.getItem(KEY);
		} catch {
			// storage blocked
		}
		const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
		this.current = isTheme(stored) ? stored : dark ? 'rtk_default_dark' : 'rtk_default_light';
		apply(this.current);
	}

	set(theme: Theme) {
		this.current = theme;
		apply(theme);
		try {
			localStorage.setItem(KEY, theme);
		} catch {
			// ignore
		}
	}

	get mode(): 'light' | 'dark' {
		return this.current.endsWith('_dark') ? 'dark' : 'light';
	}

	get palette(): 'default' | 'purple' {
		return this.current.includes('_purple_') ? 'purple' : 'default';
	}

	toggleMode() {
		this.set(`rtk_${this.palette}_${this.mode === 'dark' ? 'light' : 'dark'}` as Theme);
	}

	setPalette(palette: 'default' | 'purple') {
		this.set(`rtk_${palette}_${this.mode}` as Theme);
	}
}

export const theme = new ThemeStore();
