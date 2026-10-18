// Печатная версия руководств: какие главы входят в лист и из чего собрано оглавление. Чистые функции, без обращения к браузеру.

export type PrintGuide = 'user' | 'admin' | 'all';

/** Название руководства на титульном листе. */
export const GUIDE_TITLES: Record<PrintGuide, string> = {
	user: 'Руководство пользователя',
	admin: 'Руководство системного администратора',
	all: 'Руководства пользователя и администратора'
};

/** Группа глав, что принадлежит руководству администратора; остальные — пользовательские (начало работы, роли, справочник). */
export const ADMIN_GROUP = 'admin';

/** Неизвестное значение `?guide=` даёт руководство пользователя. */
export function parseGuide(value: string | null | undefined): PrintGuide {
	return value === 'admin' || value === 'all' ? value : 'user';
}

/**
 * Главы листа в порядке индекса: `admin` — только группа администратора, `user` — всё, кроме неё, `all` — всё.
 * Главы, скрытые по правам (`visible` вернул false), отбрасываются.
 */
export function printPlan<T extends { group: string }>(chapters: readonly T[], guide: PrintGuide, visible: (chapter: T) => boolean = () => true): T[] {
	return chapters.filter((c) => (guide === 'all' || (guide === 'admin') === (c.group === ADMIN_GROUP)) && visible(c));
}

/** Название главы — первая строка `# …` её текста; без неё — запасное. */
export function chapterTitle(markdown: string, fallback: string): string {
	return /^#\s+(.+?)\s*$/m.exec(markdown)?.[1] ?? fallback;
}

/** Текст главы без первой строки-названия: оно печатается отдельным заголовком главы. */
export function stripTitle(markdown: string): string {
	return markdown.replace(/^#\s+.+\n+/, '');
}

/** Разделы главы для оглавления: заголовки второго уровня, без явных якорей `{#id}` и без разметки. */
export function printToc(markdown: string): string[] {
	const out: string[] = [];
	let fence = false;
	for (const line of markdown.split('\n')) {
		if (/^\s*(```|~~~)/.test(line)) fence = !fence;
		if (fence) continue;
		const m = /^##\s+(.+?)\s*$/.exec(line);
		if (m) out.push(m[1].replace(/\s*\{#[\w-]+\}\s*$/, '').replace(/[`*_]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
	}
	return out;
}
