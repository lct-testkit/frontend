import { describe, expect, it } from 'vitest';
import type { Chapter } from './chapters';
import { searchChapters } from './search';

const chapter = (slug: string, title: string): Chapter => ({ slug, file: `${slug}.md`, title, group: 'user' });
const CHAPTERS = [chapter('security', 'Безопасность'), chapter('errors', 'Коды ошибок'), chapter('profile', 'Профиль и пароль')];
const TEXTS = {
	security: '# Безопасность\n\nВступление.\n\n## Смена пароля\n\nПароль не короче 12 символов. Ёлка растёт.\n\n## Сессии\n\nТекст про сессии.',
	errors: '# Коды ошибок\n\n## Вход\n\n### CRM-1101 Сессия истекла {#crm-1101}\n\nВойдите снова.\n\n### CRM-1201 Условия перехода {#crm-1201}\n\nЗаполните поля <b>и</b> повторите.',
	profile: '# Профиль и пароль\n\nДанные учётной записи.'
};

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

	it('результат несёт название раздела — «хлебную крошку» под названием главы (QA2 Н20)', () => {
		const r = searchChapters(CHAPTERS, TEXTS, 'пароль');
		expect(r.find((x) => x.slug === 'security')?.heading).toBe('Смена пароля');
		expect(r.find((x) => x.slug === 'profile')?.heading).toBeNull();
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

	it('ё и е равны, знаки в запросе отбрасываются', () => {
		expect(searchChapters(CHAPTERS, TEXTS, 'Ёлка, растёт!').map((r) => r.slug)).toEqual(['security']);
	});

	it('якоря разделов совпадают с рендером, включая явные', () => {
		expect(searchChapters(CHAPTERS, TEXTS, 'войдите')[0].anchor).toBe('h-crm-1101');
	});

	it('сниппет режется вокруг слова и ставит многоточия', () => {
		const text = `# Длинная

${'а'.repeat(200)} нужное слово ${'б'.repeat(200)}`;
		const [first] = searchChapters([chapter('long', 'Длинная')], { long: text }, 'нужное');
		expect(first.snippet.startsWith('…')).toBe(true);
		expect(first.snippet.endsWith('…')).toBe(true);
		expect(first.snippet).toContain('<mark>нужное</mark>');
		expect(first.snippet.length).toBeLessThan(260);
	});
});
