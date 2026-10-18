import { describe, expect, it } from 'vitest';
import { CHAPTERS, GROUPS, groupChapters } from './chapters';

// справка — документация: все главы видны любой роли (жюри может войти любой ролью и должно найти руководство администратора)
describe('видимость глав', () => {
	it('в меню все главы, включая руководство администратора и ролевые', () => {
		const groups = groupChapters(CHAPTERS);
		expect(groups.map((g) => g.key)).toEqual(GROUPS.map((g) => g.key));
		expect(groups.flatMap((g) => g.chapters).length).toBe(CHAPTERS.length);
		expect(CHAPTERS.filter((c) => c.group === 'admin')).toHaveLength(15);
		expect(CHAPTERS.filter((c) => c.group === 'roles').map((c) => c.slug)).toEqual(['role-kam', 'role-head', 'role-admin', 'role-auditor']);
	});

	it('ограничений по правам и ролям в индексе нет', () => {
		for (const c of CHAPTERS) expect('needs' in c, c.slug).toBe(false);
		for (const c of CHAPTERS) expect('audience' in c, c.slug).toBe(false);
	});

	it('пустые группы не возвращаются', () => {
		const groups = groupChapters(CHAPTERS.filter((c) => c.group !== 'admin'));
		expect(groups.map((g) => g.key)).not.toContain('admin');
		expect(groups.every((g) => g.chapters.length > 0)).toBe(true);
	});
});
