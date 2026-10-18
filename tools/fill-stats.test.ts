import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs без типов
import { plural, render, replaceBlock, countScreens, countComponents, countThemes, countRoles } from './fill-stats.mjs';

const T = ['тест', 'теста', 'тестов'];

describe('plural', () => {
	it('склоняет по числу', () => {
		expect(plural(471, T)).toBe('тест');
		expect(plural(472, T)).toBe('теста');
		expect(plural(11, T)).toBe('тестов');
		expect(plural(111, T)).toBe('тестов');
		expect(plural(0, T)).toBe('тестов');
		expect(plural(24, T)).toBe('теста');
	});
});

describe('replaceBlock', () => {
	const doc = 'до\n<!--STATS-->\nстарое\n<!--/STATS-->\nпосле $1 $&';
	it('меняет только текст между маркерами', () => {
		expect(replaceBlock(doc, 'новое $1')).toBe('до\n<!--STATS-->\nновое $1\n<!--/STATS-->\nпосле $1 $&');
	});
	it('без маркеров — ошибка', () => {
		expect(() => replaceBlock('нет блока', 'x')).toThrow(/STATS/);
	});
});

describe('README.md', () => {
	it('в README есть блок STATS; render идемпотентен; счётчики кода дают осмысленные числа', () => {
		const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
		const stats = { screens: countScreens(), operations: 249, called: 200, components: countComponents(), tests: 100, roles: countRoles(), themes: countThemes() };
		expect(stats.screens).toBeGreaterThan(0);
		expect(stats.components).toBeGreaterThan(0);
		expect(stats.themes).toBe(4);
		expect(stats.roles).toBe(4);
		const once = replaceBlock(readme, render(stats));
		expect(replaceBlock(once, render(stats))).toBe(once);
		expect(once).toContain('**15** блоков B1–B15 (приняты)');
	});
});
