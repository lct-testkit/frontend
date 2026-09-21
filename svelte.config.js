import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
	compilerOptions: {
		// runes everywhere except node_modules (the rt-ui package is compiled by its own settings)
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// SPA: the FastAPI backend already is the BFF (httpOnly session cookie + CSRF, OIDC callback),
		// so the web client is a static bundle that Caddy serves next to /api and /auth.
		adapter: adapter({ fallback: 'index.html', pages: 'build', assets: 'build', strict: false })
	}
};
