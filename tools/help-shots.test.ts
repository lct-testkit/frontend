import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

interface Row {
	name: string;
	chapter: string;
	who: string | null;
	mode: string;
	hasUrl: boolean;
	hasArea: boolean;
	howto: string | null;
}

// манифест кадров справки читается без браузера и без стенда
const rows: Row[] = JSON.parse(execFileSync(process.execPath, ['tools/help-shots.mjs', '--list', '--json'], { encoding: 'utf8' }));
const MODES = ['auto', 'demo-only', 'prod-url', 'keycloak', 'manual'];

describe('манифест кадров справки (tools/help-shots.mjs)', () => {
	it('имена уникальны и пригодны для файла', () => {
		expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
		for (const r of rows) expect(r.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
	});

	it('у каждого кадра есть глава и допустимый режим', () => {
		for (const r of rows) {
			expect(r.chapter.length, r.name).toBeGreaterThan(0);
			expect(MODES, r.name).toContain(r.mode);
		}
	});

	it('автоматические кадры знают адрес и область снимка, ручные описывают, как их снять', () => {
		for (const r of rows.filter((x) => x.mode === 'auto' || x.mode === 'demo-only' || x.mode === 'prod-url')) {
			expect(r.hasUrl, r.name).toBe(true);
			expect(r.hasArea, r.name).toBe(true);
		}
		for (const r of rows.filter((x) => x.mode === 'manual' || x.mode === 'keycloak')) expect(r.howto?.length ?? 0, r.name).toBeGreaterThan(20);
	});

	it('покрывает экраны из плана F6-4 и снимает воронку и карточку сделки с B2B', () => {
		const names = rows.map((r) => r.name);
		for (const n of ['teams', 'deal-card', 'deal-files', 'org-licenses', 'admin-audit-chain', 'workflow-graph', 'login-prod']) expect(names).toContain(n);
		expect(rows.filter((r) => r.mode === 'auto').length).toBeGreaterThanOrEqual(15);
	});
});
