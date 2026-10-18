import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildChapter } from '../../../../tools/gen-error-chapter.mjs';
import { extractToc, splitTitle } from './toc';

const root = process.cwd();
const catalog = JSON.parse(readFileSync(resolve(root, 'docs/error-catalog.json'), 'utf8')) as {
	areas: { key: string; title: string; prefix: string }[];
	codes: { code: string; status: number; title: string; area: string; meaning: string; action: string; who: string; reserved?: boolean }[];
};
const chapter = readFileSync(resolve(root, 'src/lib/content/help/15-errors.md'), 'utf8').replace(/\r\n/g, '\n');
const openapi = JSON.parse(readFileSync(resolve(root, 'docs/openapi.json'), 'utf8'));
const apiCodes: string[] = openapi.components.schemas.Problem.properties.code.enum;

function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sources(full);
		return /\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name) && name !== 'schema.d.ts' ? [full] : [];
	});
}

describe('каталог кодов ошибок', () => {
	it('совпадает с перечнем кодов API (enum code в docs/openapi.json)', () => {
		expect(catalog.codes.map((c) => c.code).sort()).toEqual([...apiCodes].sort());
	});

	it('коды не повторяются, область известна, поля заполнены', () => {
		const areas = new Set(catalog.areas.map((a) => a.key));
		expect(new Set(catalog.codes.map((c) => c.code)).size).toBe(catalog.codes.length);
		for (const c of catalog.codes) {
			expect(c.code, c.code).toMatch(/^CRM-\d{4}$/);
			expect(areas.has(c.area), `${c.code}: область ${c.area}`).toBe(true);
			expect(c.title.length, c.code).toBeGreaterThan(3);
			expect(c.meaning.length, `${c.code}: meaning`).toBeGreaterThan(20);
			expect(c.action.length, `${c.code}: action`).toBeGreaterThan(5);
			expect(['user', 'admin'], c.code).toContain(c.who);
		}
	});

	it('префикс области совпадает с первыми цифрами кода', () => {
		const prefix = (key: string) => catalog.areas.find((a) => a.key === key)!.prefix.split(',').map((p) => p.trim());
		for (const c of catalog.codes) expect(prefix(c.area), c.code).toContain(c.code.slice(4, 6));
	});

	it('все литералы CRM-NNNN в коде клиента входят в каталог', () => {
		const known = new Set(catalog.codes.map((c) => c.code));
		for (const file of sources(resolve(root, 'src'))) {
			for (const m of readFileSync(file, 'utf8').matchAll(/CRM-\d{4}/g)) expect(known.has(m[0]), `${file}: ${m[0]}`).toBe(true);
		}
	});
});

describe('глава «Коды ошибок»', () => {
	it('собрана из каталога (node tools/gen-error-chapter.mjs)', () => {
		expect(chapter).toBe(buildChapter(catalog));
	});

	it('на каждый код есть заголовок с явным якорем и наоборот', () => {
		const { body } = splitTitle(chapter);
		const anchors = extractToc(body)
			.filter((i) => i.depth === 3)
			.map((i) => i.id);
		expect(anchors.sort()).toEqual(catalog.codes.map((c) => `h-${c.code.toLowerCase()}`).sort());
		expect([...chapter.matchAll(/^### CRM-/gm)].length).toBe(catalog.codes.length);
	});
});
