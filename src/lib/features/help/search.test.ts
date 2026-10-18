import { describe, expect, it } from 'vitest';
import type { Chapter } from './chapters';
import { makeSnippet, queryWords, searchChapters, sectionsOf, stem } from './search';

const chapter = (slug: string, title: string): Chapter => ({ slug, file: `${slug}.md`, title, group: 'user' });
const CHAPTERS = [chapter('security', 'Безопасность'), chapter('errors', 'Коды ошибок'), chapter('profile', 'Профиль и пароль')];
const TEXTS = {
	security: '# Безопасность\n\nВступление.\n\n## Смена пароля\n\nПароль не короче 12 символов. Ёлка растёт.\n\n## Сессии\n\nТекст про сессии.',
	errors: '# Коды ошибок\n\n## Вход\n\n### CRM-1101 Сессия истекла {#crm-1101}\n\nВойдите снова.\n\n### CRM-1201 Условия перехода {#crm-1201}\n\nЗаполните поля <b>и</b> повторите.',
	profile: '# Профиль и пароль\n\nДанные учётной записи.'
};

describe('queryWords', () => {
	it('1201, crm 1201 и CRM-1201 дают один код', () => {
		expect(queryWords('1201')).toEqual(['1201']);
		expect(queryWords('crm 1201')).toEqual(['crm-1201']);
		expect(queryWords('CRM-1201')).toEqual(['crm-1201']);
	});
	it('ё и е равны, знаки отбрасываются', () => {
		expect(queryWords('Ёлка, пароль!')).toEqual(['елка', 'пароль']);
	});
});

describe('stem', () => {
	it('основа слова: пароль → пароля, сделка → сделки; коды не трогает', () => {
		expect(stem('пароль')).toBe('парол');
		expect(stem('сделка')).toBe('сделк');
		expect(stem('организации')).toBe('организац');
		expect(stem('файл')).toBe('файл');
		expect(stem('crm-1201')).toBe('crm-1201');
	});
});

describe('sectionsOf', () => {
	it('якоря разделов — те же, что у рендера, включая явные', () => {
		const { sections } = sectionsOf(TEXTS.errors);
		expect(sections.map((s) => s.anchor)).toEqual(['h-vkhod', 'h-crm-1101', 'h-crm-1201']);
	});
});

describe('searchChapters', () => {
	it('нужны все слова запроса (И)', () => {
		expect(searchChapters(CHAPTERS, TEXTS, 'пароль символов').map((r) => r.slug)).toEqual(['security']);
		expect(searchChapters(CHAPTERS, TEXTS, 'пароль ананас')).toEqual([]);
	});

	it('слово в названии главы выше слова в заголовке и в тексте', () => {
		const r = searchChapters(CHAPTERS, TEXTS, 'пароль');
		expect(r.map((x) => x.slug)).toEqual(['profile', 'security']);
		expect(r[1].anchor).toBe('h-smena-parolya');
	});

	it('слово находит свои формы: пароль → пароля', () => {
		const texts = { ...TEXTS, profile: '# Профиль\n\nСмена пароля.' };
		expect(searchChapters(CHAPTERS, texts, 'пароль').map((r) => r.slug)).toContain('profile');
	});

	it('е находит ё', () => {
		expect(searchChapters(CHAPTERS, TEXTS, 'елка').map((r) => r.slug)).toEqual(['security']);
	});

	it('код ошибки находит свою запись', () => {
		for (const q of ['1201', 'crm 1201', 'CRM-1201']) {
			const [first] = searchChapters(CHAPTERS, TEXTS, q);
			expect(first.slug, q).toBe('errors');
			expect(first.anchor, q).toBe('h-crm-1201');
		}
	});

	it('HTML в тексте экранируется до подсветки', () => {
		const [first] = searchChapters(CHAPTERS, TEXTS, 'повторите');
		expect(first.snippet).toContain('&lt;b&gt;и&lt;/b&gt;');
		expect(first.snippet).toContain('<mark>повторите</mark>');
		expect(first.snippet).not.toContain('<b>');
	});

	it('пустой запрос ничего не находит', () => {
		expect(searchChapters(CHAPTERS, TEXTS, '  ')).toEqual([]);
	});
});

describe('makeSnippet', () => {
	it('режет фрагмент вокруг слова и ставит многоточия', () => {
		const text = `${'а'.repeat(200)} нужное слово ${'б'.repeat(200)}`;
		const s = makeSnippet(text, ['нужное']);
		expect(s.startsWith('…')).toBe(true);
		expect(s.endsWith('…')).toBe(true);
		expect(s).toContain('<mark>нужное</mark>');
		expect(s.length).toBeLessThan(260);
	});
});
