import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './chapters';

const ROOT = resolve(process.cwd(), 'src/lib/content/help');

function mdFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		return statSync(full).isDirectory() ? mdFiles(full) : name.endsWith('.md') ? [relative(ROOT, full).replaceAll('\\', '/')] : [];
	});
}

describe('индекс справки', () => {
	it('каждый .md есть в индексе и наоборот', () => {
		expect(CHAPTERS.map((c) => c.file).sort()).toEqual(mdFiles(ROOT).sort());
	});

	it('slug и файлы не повторяются', () => {
		expect(new Set(CHAPTERS.map((c) => c.slug)).size).toBe(CHAPTERS.length);
		expect(new Set(CHAPTERS.map((c) => c.file)).size).toBe(CHAPTERS.length);
	});

	it('у каждой главы первая строка — заголовок первого уровня', () => {
		for (const c of CHAPTERS) {
			const first = readFileSync(join(ROOT, c.file), 'utf8').split('\n')[0];
			expect(first, c.file).toMatch(/^# \S/);
		}
	});

	it('главы руководства администратора лежат в admin/', () => {
		for (const c of CHAPTERS) {
			expect(c.file.startsWith('admin/'), c.slug).toBe(c.group === 'admin');
		}
	});
});
