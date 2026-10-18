// Оглавление главы: заголовки `##` и `###` с теми же якорями, что ставит рендер (`utils/markdown.ts`).
import { marked } from 'marked';
import { HeadingIds } from '$lib/utils/headings';

export { slugify } from '$lib/utils/headings';

export interface TocItem {
	/** 2 или 3 */
	depth: number;
	/** текст заголовка без хвоста `{#якорь}` */
	text: string;
	/** `h-…` — то, что стоит после `#` в адресе */
	id: string;
}

/** Заголовок первого уровня — название главы; в тело страницы он не попадает. */
export function splitTitle(markdown: string): { title: string | null; body: string } {
	const m = /^#\s+(.+)\n*/.exec(markdown);
	if (!m) return { title: null, body: markdown };
	return { title: m[1].trim(), body: markdown.slice(m[0].length) };
}

/** Заголовки `##`/`###` тела главы (без `# Название`). Повторы и явные якоря считаются тем же счётчиком, что у рендера. */
export function extractToc(body: string): TocItem[] {
	const ids = new HeadingIds();
	const out: TocItem[] = [];
	for (const token of marked.lexer(body)) {
		if (token.type !== 'heading') continue;
		const { text, id } = ids.next(token.text);
		if (token.depth === 2 || token.depth === 3) out.push({ depth: token.depth, text: text.replace(/[`*_]/g, ''), id });
	}
	return out;
}

/** Оглавление показываем, когда в главе три и больше разделов `##`. */
export const hasToc = (items: TocItem[]): boolean => items.filter((i) => i.depth === 2).length >= 3;
