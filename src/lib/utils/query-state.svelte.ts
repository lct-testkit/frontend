// Filters live in the URL (`?status=won&q=МГУ`): the Back button, reload and shared links all work.
import { goto } from '$app/navigation';
import { page } from '$app/state';

export type QueryValue = string | number | boolean | null | undefined | string[];

/** Read one query param (string). */
export function readQuery(name: string): string {
	return page.url.searchParams.get(name) ?? '';
}

export function readQueryList(name: string): string[] {
	return page.url.searchParams.getAll(name).flatMap((v) => v.split(',')).filter(Boolean);
}

/**
 * Merge params into the current URL without a new history entry (replaceState) and without scrolling.
 * `null | undefined | '' | false | []` remove the param. Returns the promise of the navigation.
 */
export function setQuery(patch: Record<string, QueryValue>, opts: { push?: boolean } = {}): Promise<void> {
	const url = new URL(page.url);
	for (const [key, value] of Object.entries(patch)) {
		url.searchParams.delete(key);
		if (value === null || value === undefined || value === '' || value === false) continue;
		if (Array.isArray(value)) {
			if (value.length) url.searchParams.set(key, value.join(','));
		} else {
			url.searchParams.set(key, String(value));
		}
	}
	return goto(url, { replaceState: !opts.push, keepFocus: true, noScroll: true });
}
