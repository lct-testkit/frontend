import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { LayoutLoad } from './$types';

// The block catalog is a development tool: it does not exist in a production build.
export const load: LayoutLoad = () => {
	if (!dev) error(404, 'Not found');
};
