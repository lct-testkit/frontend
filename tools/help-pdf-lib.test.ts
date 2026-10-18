import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs без типов
import { escapeHtml, indexFromFiles, parseChapterIndex, pickChapters, sectionsOf } from './help-pdf-lib.mjs';

const ts = String.raw`export const CHAPTERS: Chapter[] = [
	{ slug: 'start', file: '01-start.md', title: 'Быстрый старт', group: 'start' },
	{ slug: 'deals', file: '02-deals.md', title: 'Сделки', group: 'user', needs: ['deal:read'] },
	{ slug: 'admin-install', file: 'admin/02-install.md', title: 'Установка: онлайн и офлайн', group: 'admin', needs: ADMIN, keywords: 'install' },
	{ slug: 'x', file: 'x.md', title: 'Что\'s это', group: 'reference' }
];`;

describe('индекс глав для PDF', () => {
	it('читает записи chapters.ts в порядке объявления', () => {
		const list = parseChapterIndex(ts);
		expect(list.map((c: { slug: string }) => c.slug)).toEqual(['start', 'deals', 'admin-install', 'x']);
		expect(list[3].title).toBe("Что's это");
		expect(list[2].group).toBe('admin');
	});

	it('без индекса строит его по именам файлов: admin/ — группа администратора', () => {
		const list = indexFromFiles(['admin/02-install.md', '10-integrations.md', '02-deals.md', 'admin/10-grafana.md'], (f: string) => f);
		expect(list.map((c: { slug: string }) => c.slug)).toEqual(['deals', 'integrations', 'admin-install', 'admin-grafana']);
	});

	it('admin, user и all выбирают главы по группе', () => {
		const list = parseChapterIndex(ts);
		expect(pickChapters(list, 'admin').map((c: { slug: string }) => c.slug)).toEqual(['admin-install']);
		expect(pickChapters(list, 'user')).toHaveLength(3);
		expect(pickChapters(list, 'all')).toHaveLength(4);
	});

	it('оглавление и экранирование', () => {
		expect(sectionsOf('# T\n## Раз {#a}\n```\n## код\n```\n## **Два**\n')).toEqual(['Раз', 'Два']);
		expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
	});
});
