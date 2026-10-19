import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const serve = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe('loadConfig mailUrl', () => {
	it('keeps a same-site path', async () => {
		expect((await loadConfig(serve({ mode: 'demo', mailUrl: '/mail/' }))).mailUrl).toBe('/mail/');
	});

	it('drops off-site and protocol-relative links', async () => {
		expect((await loadConfig(serve({ mode: 'demo', mailUrl: 'https://evil.example/' }))).mailUrl).toBeUndefined();
		expect((await loadConfig(serve({ mode: 'demo', mailUrl: '//evil.example/' }))).mailUrl).toBeUndefined();
	});

	it('is absent when the stand has no mail trap', async () => {
		expect((await loadConfig(serve({ mode: 'prod' }))).mailUrl).toBeUndefined();
	});
});
