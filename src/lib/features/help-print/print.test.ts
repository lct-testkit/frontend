import { describe, expect, it } from 'vitest';
import { GUIDE_TITLES, chapterTitle, parseGuide, printPlan, printToc, stripTitle } from './print';

const chapters = [
	{ slug: 'start', group: 'start', needs: undefined as string[] | undefined },
	{ slug: 'deals', group: 'user', needs: ['deal:read'] },
	{ slug: 'role-kam', group: 'roles', needs: undefined },
	{ slug: 'admin-install', group: 'admin', needs: ['settings:write'] },
	{ slug: 'admin-smtp', group: 'admin', needs: ['settings:write'] },
	{ slug: 'shortcuts', group: 'reference', needs: undefined }
];
const slugs = (list: { slug: string }[]) => list.map((c) => c.slug);

describe('printPlan', () => {
	it('admin — только группа администратора, в порядке индекса', () => {
		expect(slugs(printPlan(chapters, 'admin'))).toEqual(['admin-install', 'admin-smtp']);
	});

	it('user — всё, кроме главы администратора; all — всё', () => {
		expect(slugs(printPlan(chapters, 'user'))).toEqual(['start', 'deals', 'role-kam', 'shortcuts']);
		expect(printPlan(chapters, 'all')).toHaveLength(chapters.length);
	});

	it('главы, скрытые по правам, отбрасываются', () => {
		const can = (c: { needs?: string[] }) => !c.needs?.length || c.needs.includes('deal:read');
		expect(slugs(printPlan(chapters, 'all', can))).toEqual(['start', 'deals', 'role-kam', 'shortcuts']);
		expect(printPlan(chapters, 'admin', can)).toEqual([]);
	});

	it('неизвестный guide даёт руководство пользователя', () => {
		expect(parseGuide('admin')).toBe('admin');
		expect(parseGuide('all')).toBe('all');
		expect(parseGuide('user')).toBe('user');
		for (const bad of [null, undefined, '', 'ADMIN', 'x', 'admin,user']) expect(parseGuide(bad)).toBe('user');
		expect(Object.keys(GUIDE_TITLES).sort()).toEqual(['admin', 'all', 'user']);
	});
});

describe('текст главы', () => {
	const md = '# Сделки\n\nВведение.\n\n## Карточка `сделки`\n\n```\n## не раздел\n```\n\n## Файлы {#files}\n\n### Не в оглавлении\n\n## [Подписание](/help?s=signing) и **статусы**\n';

	it('название — первая строка, без неё текст идёт отдельно', () => {
		expect(chapterTitle(md, 'x')).toBe('Сделки');
		expect(chapterTitle('Без заголовка', 'запасное')).toBe('запасное');
		expect(stripTitle(md).startsWith('Введение.')).toBe(true);
	});

	it('оглавление: заголовки второго уровня без разметки, якорей и блоков кода', () => {
		expect(printToc(md)).toEqual(['Карточка сделки', 'Файлы', 'Подписание и статусы']);
	});
});
