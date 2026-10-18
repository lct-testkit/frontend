import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs без типов
import { selectScenarios, summarize } from './run-scenarios.mjs';

const dir = new URL('./scenarios/', import.meta.url);
const list = JSON.parse(readFileSync(new URL('e2e.list.json', dir), 'utf8')) as { scenarios: { file: string; tier: string }[]; excluded: Record<string, string> };

describe('e2e.list.json', () => {
	it('каждый файл списка существует, имена не повторяются, уровень smoke или full', () => {
		const names = list.scenarios.map((s) => s.file);
		expect(new Set(names).size).toBe(names.length);
		for (const s of list.scenarios) {
			expect(existsSync(new URL(s.file, dir)), s.file).toBe(true);
			expect(['smoke', 'full']).toContain(s.tier);
		}
	});
	it('каждый .mjs каталога — сценарий из списка или осознанно исключён (новый файл обязан быть отнесён)', () => {
		const listed = new Set(list.scenarios.map((s) => s.file.replace(/\.mjs$/, '')));
		for (const f of readdirSync(dir).filter((n) => n.endsWith('.mjs'))) {
			const name = f.replace(/\.mjs$/, '');
			expect(listed.has(name) || name in list.excluded, `${f}: добавьте в scenarios или excluded`).toBe(true);
		}
		for (const name of Object.keys(list.excluded)) expect(existsSync(new URL(`${name}.mjs`, dir)), `${name} в excluded, но файла нет`).toBe(true);
	});
	it('быстрых сценариев шесть', () => {
		expect(list.scenarios.filter((s) => s.tier === 'smoke')).toHaveLength(6);
	});
});

describe('раннер', () => {
	it('smoke берёт только быстрые, full — все, only сужает', () => {
		expect(selectScenarios(list, 'smoke').every((s: { tier: string }) => s.tier === 'smoke')).toBe(true);
		expect(selectScenarios(list, 'full')).toHaveLength(list.scenarios.length);
		expect(selectScenarios(list, 'full', ['c-sign']).map((s: { file: string }) => s.file)).toEqual(['c-sign.mjs']);
	});
	it('сводка: код 1 при любом падении, таймаут подписан', () => {
		const ok = { file: 'a.mjs', ok: true, code: 0, timedOut: false, seconds: 3 };
		const bad = { file: 'b.mjs', ok: false, code: null, timedOut: true, seconds: 240 };
		expect(summarize([ok]).exitCode).toBe(0);
		const s = summarize([ok, bad]);
		expect(s.exitCode).toBe(1);
		expect(s.text).toContain('таймаут');
		expect(s.text).toContain('упало 1 из 2');
	});
});
