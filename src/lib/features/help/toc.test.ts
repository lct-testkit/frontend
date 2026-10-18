import { describe, expect, it } from 'vitest';
import { HeadingIds, isInternalHref, slugify, splitExplicitId } from '$lib/utils/headings';
import { extractToc, hasToc, splitTitle } from './toc';

describe('slugify', () => {
	it('транслитерирует кириллицу', () => {
		expect(slugify('Резервное копирование')).toBe('h-rezervnoe-kopirovanie');
		expect(slugify('Ёлка и щука')).toBe('h-elka-i-shchuka');
	});
	it('оставляет цифры, остальное сводит к дефису', () => {
		expect(slugify('Шаг 3: TLS (acme)')).toBe('h-shag-3-tls-acme');
	});
	it('пустой заголовок не даёт пустой якорь', () => {
		expect(slugify('***')).toBe('h-razdel');
	});
});

describe('HeadingIds', () => {
	it('повтор получает суффикс -2, -3', () => {
		const ids = new HeadingIds();
		expect(ids.next('Шаги').id).toBe('h-shagi');
		expect(ids.next('Шаги').id).toBe('h-shagi-2');
		expect(ids.next('Шаги').id).toBe('h-shagi-3');
	});
	it('явный якорь побеждает и убирается из текста', () => {
		expect(splitExplicitId('CRM-1201 Условия {#crm-1201}')).toEqual({ text: 'CRM-1201 Условия', id: 'h-crm-1201' });
		const ids = new HeadingIds();
		expect(ids.next('CRM-1201 Условия {#crm-1201}')).toEqual({ text: 'CRM-1201 Условия', id: 'h-crm-1201' });
	});
});

describe('extractToc', () => {
	const md = ['Вступление', '', '## Что понадобится', '', '### Требования', '', '## Шаги', '', '```bash', '# не заголовок', '```', '', '## Шаги', '', '#### глубже'].join('\n');
	it('берёт ## и ###, пропускает код и более глубокие заголовки', () => {
		expect(extractToc(md)).toEqual([
			{ depth: 2, text: 'Что понадобится', id: 'h-chto-ponadobitsya' },
			{ depth: 3, text: 'Требования', id: 'h-trebovaniya' },
			{ depth: 2, text: 'Шаги', id: 'h-shagi' },
			{ depth: 2, text: 'Шаги', id: 'h-shagi-2' }
		]);
	});
	it('оглавление показывается от трёх разделов ##', () => {
		expect(hasToc(extractToc(md))).toBe(true);
		expect(hasToc(extractToc('## а\n\n## б'))).toBe(false);
	});
});

describe('splitTitle', () => {
	it('отделяет заголовок первого уровня', () => {
		expect(splitTitle('# Название\n\nТекст')).toEqual({ title: 'Название', body: 'Текст' });
		expect(splitTitle('Без заголовка').title).toBeNull();
	});
});

describe('isInternalHref', () => {
	it('ссылки внутри справки остаются в той же вкладке', () => {
		for (const h of ['?s=admin-backup', '?s=errors#h-crm-1201', '#h-x', '/help', '/help?s=deals', '?q=пароль']) expect(isInternalHref(h), h).toBe(true);
	});
	it('внешние и чужие — нет', () => {
		for (const h of ['https://example.com', '//evil.example', '/deals', 'mailto:a@b.c', '', null, undefined]) expect(isInternalHref(h), String(h)).toBe(false);
	});
});
