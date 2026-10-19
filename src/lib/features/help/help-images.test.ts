import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Картинки справки: каждая ссылка из глав ведёт на существующий файл, сирот нет, размеры в границах, манифест источников совпадает с файлами.
const root = process.cwd();
const CONTENT = resolve(root, 'src/lib/content/help');
const STATIC = resolve(root, 'static/help');

const WIDTH = 900;
const MIN_HEIGHT = 60;
const MAX_BYTES = 200 * 1024;

function markdownFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? markdownFiles(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : []));
}

/** Ссылки `![подпись](/help/имя.png)` во всех главах: глава → [{ alt, file }]. */
const refs = markdownFiles(CONTENT).flatMap((file) => {
	const text = readFileSync(file, 'utf8');
	return [...text.matchAll(/!\[([^\]]*)\]\((\/help\/[^)\s]+)\)/g)].map((m) => ({ chapter: file.slice(CONTENT.length + 1).replaceAll('\\', '/'), alt: m[1], src: m[2] }));
});

const files = readdirSync(STATIC).filter((f) => !f.startsWith('.'));
const png = files.filter((f) => f.endsWith('.png'));
const size = (name: string) => {
	const buf = readFileSync(join(STATIC, name));
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length, signature: buf.subarray(1, 4).toString('latin1') };
};

describe('картинки глав справки', () => {
	it('в главах есть картинки', () => {
		expect(refs.length).toBeGreaterThan(20);
	});

	it('каждая ссылка указывает на существующий файл в static/help', () => {
		for (const r of refs) expect(files, `${r.chapter}: ${r.src}`).toContain(r.src.slice('/help/'.length));
	});

	it('у каждой картинки есть подпись', () => {
		for (const r of refs) expect(r.alt.trim().length, `${r.chapter}: ${r.src}`).toBeGreaterThan(10);
	});

	it('сирот нет: каждый PNG из static/help показан в какой-нибудь главе', () => {
		const used = new Set(refs.map((r) => r.src.slice('/help/'.length)));
		expect(png.filter((f) => !used.has(f))).toEqual([]);
	});

	it('в static/help только PNG', () => {
		expect(files.filter((f) => !f.endsWith('.png'))).toEqual([]);
	});

	it(`PNG: настоящий PNG, ширина ${WIDTH} px, высота не меньше ${MIN_HEIGHT}, не тяжелее 200 КБ`, () => {
		for (const f of png) {
			const s = size(f);
			expect(s.signature, f).toBe('PNG');
			expect(s.width, `${f}: ширина`).toBe(WIDTH);
			expect(s.height, `${f}: высота`).toBeGreaterThanOrEqual(MIN_HEIGHT);
			expect(s.bytes, `${f}: размер`).toBeLessThanOrEqual(MAX_BYTES);
		}
	});

	it('картинки не обновлялись «пустыми»: ни одного файла нулевого размера', () => {
		for (const f of png) expect(statSync(join(STATIC, f)).size, f).toBeGreaterThan(1000);
	});
});

describe('манифест источников картинок (tools/help-shots.manifest.json)', () => {
	const manifest = (JSON.parse(readFileSync(resolve(root, 'tools/help-shots.manifest.json'), 'utf8')) as { shots: { name: string; file: string; sources: string[] }[] }).shots;

	it('для каждого PNG есть запись, а у записи — существующий файл', () => {
		expect(manifest.map((m) => m.file.replace('static/help/', '')).sort()).toEqual([...png].sort());
	});

	it('источники существуют в репозитории', () => {
		for (const m of manifest) {
			expect(m.sources.length, m.name).toBeGreaterThan(0);
			for (const src of m.sources) expect(() => statSync(resolve(root, src.replace(/\/$/, ''))), `${m.name}: ${src}`).not.toThrow();
		}
	});
});
