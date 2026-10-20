import { describe, expect, it } from 'vitest';
import { correctedNote, searchGroups, searchText } from './global-search';

describe('searchText', () => {
	it('короче двух знаков — искать рано, лишние пробелы убираются, длина не больше 200', () => {
		expect(searchText('')).toBeNull();
		expect(searchText(' п ')).toBeNull();
		expect(searchText('  мос ')).toBe('мос');
		expect(searchText('а'.repeat(300))).toHaveLength(200);
	});
});

describe('searchGroups', () => {
	const res = {
		deals: [{ id: 'd1', number: 'D-1', title: 'Курс' }],
		organizations: [
			{ id: 'o1', name: 'Московский университет', short_name: 'МУ', inn: '7700000000' },
			{ id: 'o2', name: 'Без ИНН', short_name: null, inn: null }
		],
		contacts: [{ id: 'c1', last_name: 'Иванов', first_name: 'Иван', position: 'Проректор' }]
	};
	it('одна ручка → три группы со ссылками', () => {
		const groups = searchGroups(res);
		expect(groups.map((g) => g.key)).toEqual(['deals', 'orgs', 'contacts']);
		expect(groups[0]!.rows[0]).toEqual({ id: 'd1', href: '/deals/d1', primary: 'Курс', secondary: 'D-1' });
		expect(groups[1]!.rows.map((r) => [r.primary, r.secondary])).toEqual([['МУ', 'ИНН 7700000000'], ['Без ИНН', undefined]]);
		expect(groups[2]!.rows[0]).toMatchObject({ href: '/contacts/c1', primary: 'Иванов Иван', secondary: 'Проректор' });
	});
	it('пустые группы не показываются', () => {
		expect(searchGroups({ deals: [], organizations: [], contacts: [] })).toEqual([]);
		expect(searchGroups({ ...res, deals: [], contacts: [] }).map((g) => g.key)).toEqual(['orgs']);
	});
});

describe('correctedNote', () => {
	it('подпись только при исправленной раскладке', () => {
		expect(correctedNote('ппу')).toBe('Показаны результаты для «ппу»');
		expect(correctedNote(null)).toBeNull();
		expect(correctedNote('')).toBeNull();
	});
});
