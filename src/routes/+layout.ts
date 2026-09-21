import { loadConfig } from '$lib/config';
import type { LayoutLoad } from './$types';

// SPA: no server rendering. The BFF/session lives in the backend (cookie) or in the demo token store.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';

export const load: LayoutLoad = async ({ fetch }) => ({ config: await loadConfig(fetch) });
