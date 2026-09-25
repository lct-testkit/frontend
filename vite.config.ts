import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

// Dev proxy: the browser only ever talks to ONE origin (like behind Caddy in production).
// changeOrigin: the backend's Keycloak derives the token issuer from Host/X-Forwarded-Host, and the API validates it against
// its own public URL (http://localhost:8080/auth/...), so the proxy must present itself as the backend's host.
// /api, /public, /health, /static (Swagger UI assets — mounted on the FastAPI app outside /api, see
// app/api/docs.py) go to the FastAPI app, /auth to Keycloak — both are published by Caddy on :8080.
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const backend = env.BACKEND_URL || 'http://localhost:8080';
	const proxy = Object.fromEntries(
		['/api', '/public', '/health', '/auth', '/static'].map((path) => [
			path,
			{ target: backend, changeOrigin: true, xfwd: false }
		])
	);

	return {
		plugins: [tailwindcss(), sveltekit()],
		server: {
			host: '0.0.0.0',
			port: 5273,
			strictPort: true,
			proxy,
			fs: { allow: ['.', '../rt-ui'] }
		},
		preview: { proxy },
		// rt-ui ships plain-ESM/CJS helpers that must be pre-bundled for the browser (pnpm keeps them nested)
		optimizeDeps: {
			include: ['attr-accept', 'imask', 'card-validator', 'clsx', 'dayjs', 'virtua', '@popperjs/core'].map((d) => `@lct-testkit/rt-ui > ${d}`)
		},
		build: { target: 'es2022', chunkSizeWarningLimit: 900 },
		test: {
			include: ['src/**/*.{test,spec}.ts'],
			environment: 'node',
			coverage: {
				// unit-тесты покрывают чистую логику (.ts); компоненты (.svelte) проверяются svelte-check и e2e
				provider: 'v8',
				include: ['src/lib/**/*.ts'],
				exclude: ['src/lib/**/*.test.ts', 'src/lib/**/*.d.ts', 'src/lib/api/schema.d.ts'],
				reporter: ['text-summary', 'lcov'],
				// пороги по измеренной базе (2026-09-25: lines 49%, branches 83%, functions 88%) с запасом; поднимайте, не опускайте
				thresholds: { lines: 45, statements: 45, branches: 78, functions: 82 }
			}
		}
	};
});
